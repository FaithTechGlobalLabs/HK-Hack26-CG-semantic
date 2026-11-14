using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using LMKit.Embeddings;
using LMKit.Model;
using LMKit.TextAnalysis;
using LMKit.TextGeneration;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins("http://localhost:3000")
        .AllowAnyHeader()
        .AllowAnyMethod()));

var contentRootDataPath = Path.Combine(builder.Environment.ContentRootPath, "demo-data.json");
var dataPath = File.Exists(contentRootDataPath)
    ? contentRootDataPath
    : Path.Combine(builder.Environment.ContentRootPath, "backend", "demo-data.json");
var store = await DemoStore.LoadAsync(dataPath);

Console.WriteLine("Loading the local embedding model for model recommendations and semantic search.");
var embeddingModel = LM.LoadFromModelID("nomic-embed-text");
var embedder = new Embedder(embeddingModel);
var chatModelId = await SelectChatModelIdAsync(
    builder.Configuration["ChatModelId"] ??
    Environment.GetEnvironmentVariable("CELL_HEALTH_CHAT_MODEL"),
    embedder);
Console.WriteLine($"Loading chat model '{chatModelId}'. The first run may download several GB.");
var chatModel = LM.LoadFromModelID(chatModelId);
var seededEmbeddings = await embedder.GetEmbeddingsAsync(
    store.CheckIns.Select(checkIn => checkIn.SynthesizedSummary));
if (seededEmbeddings.Length != store.CheckIns.Count)
{
    throw new InvalidOperationException("The embedding model returned an incomplete seed batch.");
}

for (var index = 0; index < seededEmbeddings.Length; index++)
{
    store.CheckIns[index].Embedding = seededEmbeddings[index];
}

builder.Services.AddSingleton(store);
builder.Services.AddSingleton(new ModelServices(chatModel, embedder));
builder.Services.AddSingleton(new SemaphoreSlim(1, 1));

var app = builder.Build();
app.UseCors();

app.MapGet("/api/dashboard", GetDashboard);
app.MapPost("/api/chat", Chat);
app.MapPost("/api/analyze", Analyze);
app.MapPost("/api/search", Search);

app.Run();

static IResult GetDashboard(string? role, string? groupId, DemoStore store)
{
    if (!IsValidRole(role))
    {
        return Results.BadRequest(new { error = "role must be member, leader, or staff." });
    }

    if (role == "member")
    {
        var memberGroup = store.FindGroup(groupId);
        if (memberGroup is null)
        {
            return groupId is null
                ? Results.BadRequest(new { error = "groupId is required for member dashboards." })
                : Results.NotFound(new { error = "Group not found." });
        }

        var submitted = store.GetCheckIns(memberGroup.Id)
            .Any(checkIn => checkIn.Role == "member");
        return Results.Ok(new
        {
            role,
            groupId,
            checkInStatus = submitted ? "submitted" : "not_submitted"
        });
    }

    if (role == "leader")
    {
        var leaderGroup = store.FindGroup(groupId);
        if (leaderGroup is null)
        {
            return groupId is null
                ? Results.BadRequest(new { error = "groupId is required for leader dashboards." })
                : Results.NotFound(new { error = "Group not found." });
        }

        var checkIns = store.GetCheckIns(leaderGroup.Id);
        if (checkIns.Count < 3)
        {
            return Results.Ok(new
            {
                role,
                group = ToGroupSummary(leaderGroup),
                status = "insufficient_data"
            });
        }

        return Results.Ok(new
        {
            role,
            group = ToGroupSummary(leaderGroup),
            status = "ready",
            domainScores = GetDomainScores(checkIns)
        });
    }

    var groups = store.Groups.Select(group =>
    {
        var checkIns = store.GetCheckIns(group.Id);
        return new
        {
            group = ToGroupSummary(group),
            checkInCount = checkIns.Count,
            domainScores = GetDomainScores(checkIns),
            triangulatedNotes = checkIns
                .OrderByDescending(checkIn => checkIn.CreatedAt)
                .Select(checkIn => new
                {
                    checkIn.PrimaryDomain,
                    checkIn.SynthesizedSummary,
                    checkIn.CreatedAt
                })
                .ToArray(),
            burnoutAlerts = checkIns
                .Where(checkIn => checkIn.BurnoutFlag)
                .Select(checkIn => new
                {
                    checkIn.PrimaryDomain,
                    checkIn.SynthesizedSummary,
                    checkIn.CreatedAt
                })
                .ToArray()
        };
    }).ToArray();

    return Results.Ok(new
    {
        role,
        networkGroupCount = 108,
        seededGroupCount = store.SeededGroupCount,
        groups
    });
}

static async Task<IResult> Chat(
    ChatRequest request,
    ModelServices models,
    SemaphoreSlim inferenceLock,
    CancellationToken cancellationToken)
{
    if (!IsValidRole(request.Role))
    {
        return Results.BadRequest(new { error = "role must be member, leader, or staff." });
    }

    if (string.IsNullOrWhiteSpace(request.Message) || request.Message.Length > 4000)
    {
        return Results.BadRequest(new { error = "message is required and must be at most 4000 characters." });
    }

    var history = request.History ?? [];
    var priorUserTurns = history.Count(message => message.Role == "user");
    var turn = priorUserTurns + 1;
    if (turn > 3)
    {
        return Results.BadRequest(new { error = "A check-in conversation is limited to three user turns." });
    }

    var prompt = BuildChatPrompt(request.Role, request.Message, history, turn);
    await inferenceLock.WaitAsync(cancellationToken);
    try
    {
        using var conversation = new MultiTurnConversation(models.ChatModel)
        {
            SystemPrompt = GetSystemPrompt(request.Role),
            MaximumCompletionTokens = 160,
            ReasoningLevel = LMKit.TextGeneration.Chat.ReasoningLevel.None
        };
        var generated = await conversation.SubmitAsync(prompt, cancellationToken);
        var response = LimitToTwoSentences(generated.Content);
        return Results.Ok(new { response, turn, isComplete = turn == 3 });
    }
    finally
    {
        inferenceLock.Release();
    }
}

static async Task<IResult> Analyze(
    AnalyzeRequest request,
    DemoStore store,
    ModelServices models,
    SemaphoreSlim inferenceLock,
    CancellationToken cancellationToken)
{
    if (!IsValidRole(request.Role))
    {
        return Results.BadRequest(new { error = "role must be member, leader, or staff." });
    }

    var group = store.FindGroup(request.GroupId);
    if (group is null)
    {
        return Results.NotFound(new { error = "Group not found." });
    }

    if (string.IsNullOrWhiteSpace(request.SynthesizedSummary) ||
        request.SynthesizedSummary.Length > 8000)
    {
        return Results.BadRequest(new { error = "synthesizedSummary is required and must be at most 8000 characters." });
    }

    if (request.Transcript?.Length > 20000)
    {
        return Results.BadRequest(new { error = "transcript must be at most 20000 characters." });
    }

    var participantText = string.Join(
        "\n\n",
        request.ParticipantResponses?
            .Where(response => !string.IsNullOrWhiteSpace(response))
            .Select(response => response.Trim()) ?? []);
    if (string.IsNullOrWhiteSpace(participantText))
    {
        participantText = request.SynthesizedSummary.Trim();
    }

    await inferenceLock.WaitAsync(cancellationToken);
    try
    {
        var categorizer = new Categorization(models.ChatModel)
        {
            Guidance = "Classify the check-in by its strongest psychological safety theme. Choose burnout only when leader exhaustion or unsustainable burden is present."
        };
        var categoryIndex = await categorizer.GetBestCategoryAsync(
            CellHealthConfig.Categories,
            participantText,
            normalize: true,
            cancellationToken: cancellationToken);
        if (categoryIndex < 0 || categoryIndex >= CellHealthConfig.Categories.Length)
        {
            return Results.Problem("The model did not return a valid check-in category.");
        }

        var category = CellHealthConfig.Categories[categoryIndex];
        var domain = CellHealthConfig.CategoryDomains[category];
        var sentiment = CellHealthConfig.CategorySentiments[category];
        var burnout = category == "leader exhaustion or burnout";
        using var summaryConversation = new MultiTurnConversation(models.ChatModel)
        {
            SystemPrompt = "Create a brief, compassionate, anonymized summary of a church-group check-in. Describe themes, not individuals. Never include names, identifying details, or direct quotes. Do not diagnose or make claims beyond what the participant shared.",
            MaximumCompletionTokens = 120,
            ReasoningLevel = LMKit.TextGeneration.Chat.ReasoningLevel.None
        };
        var summaryResult = await summaryConversation.SubmitAsync(
            $"Summarize the themes in these participant responses in one or two sentences:\n\n{participantText}",
            cancellationToken);
        var synthesizedSummary = LimitToTwoSentences(summaryResult.Content);
        if (string.IsNullOrWhiteSpace(synthesizedSummary))
        {
            return Results.Problem("The model did not return an anonymized check-in summary.");
        }

        var embedding = await models.Embedder.GetEmbeddingsAsync(
            synthesizedSummary,
            cancellationToken);

        var checkIn = new CheckIn
        {
            Id = Guid.NewGuid().ToString("N"),
            GroupId = group.Id,
            Role = request.Role,
            SynthesizedSummary = synthesizedSummary,
            Transcript = request.Transcript?.Trim() ?? "",
            CreatedAt = DateTimeOffset.UtcNow,
            PrimaryDomain = domain,
            HealthSentiment = sentiment,
            BurnoutFlag = burnout,
            Embedding = embedding
        };

        await store.AddAndPersistAsync(checkIn, cancellationToken);
        return Results.Ok(new
        {
            checkIn.Id,
            checkIn.GroupId,
            checkIn.Role,
            category,
            checkIn.PrimaryDomain,
            checkIn.HealthSentiment,
            checkIn.BurnoutFlag,
            synthesizedSummary
        });
    }
    finally
    {
        inferenceLock.Release();
    }
}

static async Task<IResult> Search(
    SearchRequest request,
    DemoStore store,
    ModelServices models,
    SemaphoreSlim inferenceLock,
    CancellationToken cancellationToken)
{
    if (string.IsNullOrWhiteSpace(request.Query) || request.Query.Length > 2000)
    {
        return Results.BadRequest(new { error = "query is required and must be at most 2000 characters." });
    }

    await inferenceLock.WaitAsync(cancellationToken);
    try
    {
        var queryVector = await models.Embedder.GetEmbeddingsAsync(request.Query, cancellationToken);
        var matches = store.CheckIns
            .Where(checkIn => checkIn.Embedding is { Length: > 0 })
            .Select(checkIn => new
            {
                CheckIn = checkIn,
                Similarity = Embedder.GetCosineSimilarity(queryVector, checkIn.Embedding!)
            })
            .GroupBy(match => match.CheckIn.GroupId)
            .Select(group => group.MaxBy(match => match.Similarity)!)
            .OrderByDescending(match => match.Similarity)
            .Take(5)
            .Select(match => new
            {
                group = ToGroupSummary(store.FindGroup(match.CheckIn.GroupId)!),
                match.CheckIn.PrimaryDomain,
                insight = match.CheckIn.SynthesizedSummary,
                similarity = match.Similarity,
                match.CheckIn.HealthSentiment
            })
            .ToArray();

        return Results.Ok(new { query = request.Query, matches });
    }
    finally
    {
        inferenceLock.Release();
    }
}

static async Task<string> SelectChatModelIdAsync(string? configuredModelId, Embedder embedder)
{
    var chatModels = ModelCard.GetPredefinedModelCards(dropSmallerModels: false)
        .Where(card =>
            card.Capabilities.HasFlag(ModelCapabilities.Chat) &&
            !string.IsNullOrWhiteSpace(card.ModelID))
        .OrderBy(card => card.ParameterCount)
        .ThenBy(card => card.ModelName, StringComparer.OrdinalIgnoreCase)
        .ToArray();
    if (chatModels.Length == 0)
    {
        throw new InvalidOperationException("The LM-Kit catalog contains no chat-capable models.");
    }

    var defaultModel = chatModels.FirstOrDefault(card =>
        string.Equals(card.ModelID, "qwen3.5:4b", StringComparison.OrdinalIgnoreCase)) ?? chatModels[0];

    if (!string.IsNullOrWhiteSpace(configuredModelId))
    {
        var configuredModel = chatModels.FirstOrDefault(card =>
            string.Equals(card.ModelID, configuredModelId.Trim(), StringComparison.OrdinalIgnoreCase));
        if (configuredModel is null)
        {
            throw new InvalidOperationException(
                $"'{configuredModelId}' is not a chat-capable model in the LM-Kit catalog.");
        }

        return configuredModel.ModelID;
    }

    if (Console.IsInputRedirected || Console.IsOutputRedirected)
    {
        Console.WriteLine($"No chat model selected in a non-interactive session; using {defaultModel.ModelID}.");
        return defaultModel.ModelID;
    }

    Console.WriteLine($"Preparing semantic search across {chatModels.Length} chat-capable models.");
    var modelDescriptions = chatModels.Select(BuildModelDescription).ToArray();
    var modelEmbeddings = await embedder.GetEmbeddingsAsync(modelDescriptions);
    if (modelEmbeddings.Length != chatModels.Length)
    {
        throw new InvalidOperationException("The embedding model returned an incomplete model-catalog batch.");
    }

    var availableMemoryBytes = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes;
    if (availableMemoryBytes > 0)
    {
        Console.WriteLine(
            $"Estimated memory budget: {availableMemoryBytes / (1024d * 1024 * 1024):F1} GB. " +
            "Fit labels are rough; actual use also depends on runtime and context size.");
    }

    while (true)
    {
        Console.Write("Describe what you need from the chat model (or type 'default' to use the default): ");
        var query = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(query) ||
            string.Equals(query, "default", StringComparison.OrdinalIgnoreCase))
        {
            return defaultModel.ModelID;
        }

        var queryEmbeddings = await embedder.GetEmbeddingsAsync(new[] { query });
        if (queryEmbeddings.Length != 1)
        {
            throw new InvalidOperationException("The embedding model did not return a query embedding.");
        }

        var matches = chatModels
            .Select((card, index) => new
            {
                Card = card,
                Similarity = CosineSimilarity(queryEmbeddings[0], modelEmbeddings[index])
            })
            .OrderByDescending(match => match.Similarity)
            .Take(10)
            .ToArray();

        Console.WriteLine("Closest matches:");
        for (var index = 0; index < matches.Length; index++)
        {
            var model = matches[index].Card;
            var name = string.IsNullOrWhiteSpace(model.ModelName) ? model.ModelID : model.ModelName;
            var size = model.FileSize > 0
                ? $"{model.FileSize / (1024d * 1024 * 1024):F1} GB"
                : "size unknown";
            var availability = model.IsLocallyAvailable ? "downloaded" : $"download {size}";
            var fit = GetModelFitEstimate(model, availableMemoryBytes);
            Console.WriteLine(
                $"  {index + 1}. {name} [{model.ModelID}] — match {matches[index].Similarity:P0}, {availability}, {fit}");
            if (!string.IsNullOrWhiteSpace(model.Description))
            {
                Console.WriteLine($"     {model.Description}");
            }
        }

        Console.Write($"Select a model [1-{matches.Length}], or press Enter to describe your needs again: ");
        var selectionInput = Console.ReadLine();
        if (int.TryParse(selectionInput, out var selection) && selection >= 1 && selection <= matches.Length)
        {
            return matches[selection - 1].Card.ModelID;
        }

        if (!string.IsNullOrWhiteSpace(selectionInput))
        {
            Console.WriteLine($"Enter a number from 1 to {matches.Length}, or press Enter to search again.");
        }
    }
}

static string BuildModelDescription(ModelCard card) =>
    $"{card.ModelName} ({card.ModelID}). {card.Description} " +
    $"Chat model with {card.ParameterCount} parameters and a {card.FileSize}-byte model file.";

static double CosineSimilarity(IReadOnlyList<float> first, IReadOnlyList<float> second)
{
    if (first.Count == 0 || first.Count != second.Count)
    {
        throw new InvalidOperationException("Model catalog embeddings have incompatible dimensions.");
    }

    double dotProduct = 0;
    double firstMagnitude = 0;
    double secondMagnitude = 0;
    for (var index = 0; index < first.Count; index++)
    {
        dotProduct += first[index] * second[index];
        firstMagnitude += first[index] * first[index];
        secondMagnitude += second[index] * second[index];
    }

    var denominator = Math.Sqrt(firstMagnitude * secondMagnitude);
    if (denominator == 0)
    {
        throw new InvalidOperationException("The embedding model returned an empty model-catalog embedding.");
    }

    return dotProduct / denominator;
}

static string GetModelFitEstimate(ModelCard model, long availableMemoryBytes)
{
    if (availableMemoryBytes <= 0 || model.FileSize <= 0)
    {
        return "fit unknown";
    }

    if (model.FileSize > availableMemoryBytes)
    {
        return "model file exceeds the memory budget";
    }

    return model.FileSize <= availableMemoryBytes / 2
        ? "likely to fit (rough estimate)"
        : "may be tight; runtime needs extra memory";
}

static string BuildChatPrompt(string role, string message, IReadOnlyList<ChatMessageRequest> history, int turn)
{
    var prompt = new StringBuilder();
    prompt.AppendLine($"This is check-in turn {turn} of 3.");
    foreach (var item in history.TakeLast(6))
    {
        if ((item.Role == "user" || item.Role == "assistant") &&
            !string.IsNullOrWhiteSpace(item.Content))
        {
            prompt.Append(item.Role == "user" ? "Participant: " : "You: ")
                .AppendLine(item.Content[..Math.Min(item.Content.Length, 2000)]);
        }
    }

    prompt.AppendLine("Current participant message:");
    prompt.Append(message);
    prompt.AppendLine();
    prompt.Append(role switch
    {
        "member" => turn switch
        {
            1 => "Briefly acknowledge the participant's answer, then ask this question exactly: \"When you have a hard week, what kind of support from someone in the group would help you most?\" Do not ask another question.",
            2 => "Briefly acknowledge the answer, then ask this question exactly: \"What is one small thing the group could do to help you feel more connected or supported?\" Do not ask another question.",
            _ => "Close warmly in one short statement. Do not ask another question; the check-in is complete."
        },
        "leader" => turn switch
        {
            1 => "Briefly acknowledge the leader's answer, then ask this question exactly: \"What part of leading has been hardest to manage lately?\" Do not ask another question.",
            2 => "Briefly acknowledge the answer, then ask this question exactly: \"What is one responsibility you could share with someone else to make leading more sustainable?\" Do not ask another question.",
            _ => "Close warmly in one short statement. Do not ask another question; the check-in is complete."
        },
        _ => "Acknowledge the answer briefly and ask no more than one open question."
    });
    return prompt.ToString();
}

static string GetSystemPrompt(string role) => role switch
{
    "member" =>
        "You are a warm, attentive pastoral companion checking in with a church member. Listen without judgment, do not diagnose or pressure them, and use natural, compassionate language. Keep every reply to at most two short sentences and ask no more than one question.",
    "leader" =>
        "You are a thoughtful pastoral coach checking in with a cell leader. Be warm and non-robotic, honor the realities of leadership, and invite honest reflection without judgment. Keep every reply to at most two short sentences and ask no more than one question.",
    _ =>
        "You are a supportive pastoral colleague checking in with church staff. Be warm and non-robotic, make room for strain as well as hope, and invite honest reflection without judgment. Keep every reply to at most two short sentences and ask no more than one question."
};

static string LimitToTwoSentences(string text)
{
    var sentences = Regex.Split(text.Trim(), @"(?<=[.!?])\s+")
        .Where(sentence => !string.IsNullOrWhiteSpace(sentence))
        .Take(2);
    return string.Join(" ", sentences);
}

static bool IsValidRole(string? role) =>
    role is "member" or "leader" or "staff";

static object ToGroupSummary(CellGroup group) => new
{
    group.Id,
    group.Name,
    group.District
};

static object[] GetDomainScores(IReadOnlyCollection<CheckIn> checkIns) =>
    CellHealthConfig.Domains.Select(domain =>
    {
        var entries = checkIns.Where(checkIn => checkIn.PrimaryDomain == domain).ToArray();
        return (object)new
        {
            domain,
            score = entries.Length == 0
                ? (double?)null
                : Math.Round(entries.Average(checkIn => (checkIn.HealthSentiment + 1) * 50), 1),
            checkInCount = entries.Length
        };
    }).ToArray();

internal static class CellHealthConfig
{
    public static readonly string[] Categories =
    [
        "authentic vulnerability and trust",
        "superficiality or fear of judgment",
        "inclusion and warm belonging",
        "cliquishness or feeling isolated",
        "mutual care and shared burden",
        "leader exhaustion or burnout"
    ];

    public static readonly string[] Domains =
    [
        "vulnerability",
        "inclusion",
        "mutual_care",
        "leader_sustainability"
    ];

    public static readonly IReadOnlyDictionary<string, string> CategoryDomains =
        new Dictionary<string, string>
        {
            ["authentic vulnerability and trust"] = "vulnerability",
            ["superficiality or fear of judgment"] = "vulnerability",
            ["inclusion and warm belonging"] = "inclusion",
            ["cliquishness or feeling isolated"] = "inclusion",
            ["mutual care and shared burden"] = "mutual_care",
            ["leader exhaustion or burnout"] = "leader_sustainability"
        };

    public static readonly IReadOnlyDictionary<string, double> CategorySentiments =
        new Dictionary<string, double>
        {
            ["authentic vulnerability and trust"] = 0.8,
            ["superficiality or fear of judgment"] = -0.5,
            ["inclusion and warm belonging"] = 0.8,
            ["cliquishness or feeling isolated"] = -0.6,
            ["mutual care and shared burden"] = 0.7,
            ["leader exhaustion or burnout"] = -0.9
        };
}

internal sealed record ModelServices(LM ChatModel, Embedder Embedder);

internal sealed class DemoStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    private readonly string _dataPath;
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private readonly object _sync = new();
    private readonly List<CellGroup> _groups;
    private readonly List<CheckIn> _checkIns;
    private readonly int _seededGroupCount;

    private DemoStore(string dataPath, DemoData data)
    {
        _dataPath = dataPath;
        _groups = data.Groups;
        _checkIns = data.CheckIns;
        _seededGroupCount = data.Groups.Count;
        AddUnseededGroups();

        if (_groups.Count != 108)
        {
            throw new InvalidDataException("demo-data.json must seed no more than 108 unique groups.");
        }
    }

    public IReadOnlyList<CellGroup> Groups => _groups;
    public int SeededGroupCount => _seededGroupCount;
    public List<CheckIn> CheckIns => _checkIns;

    public static async Task<DemoStore> LoadAsync(string dataPath)
    {
        if (!File.Exists(dataPath))
        {
            throw new FileNotFoundException("The local demo-data.json file is required.", dataPath);
        }

        await using var stream = File.OpenRead(dataPath);
        var data = await JsonSerializer.DeserializeAsync<DemoData>(stream, JsonOptions);
        if (data is null || data.Groups.Count == 0)
        {
            throw new InvalidDataException("demo-data.json must contain at least one group.");
        }

        return new DemoStore(dataPath, data);
    }

    public CellGroup? FindGroup(string? groupId)
    {
        if (groupId is null)
        {
            return null;
        }

        var lookupId = groupId;
        if (groupId.StartsWith("group-", StringComparison.OrdinalIgnoreCase) &&
            int.TryParse(groupId.AsSpan("group-".Length), out var groupNumber))
        {
            lookupId = $"G{groupNumber:000}";
        }

        lock (_sync)
        {
            return _groups.FirstOrDefault(group =>
                string.Equals(group.Id, lookupId, StringComparison.OrdinalIgnoreCase));
        }
    }

    public List<CheckIn> GetCheckIns(string? groupId)
    {
        lock (_sync)
        {
            return _checkIns
                .Where(checkIn => string.Equals(checkIn.GroupId, groupId, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
    }

    public async Task AddAndPersistAsync(CheckIn checkIn, CancellationToken cancellationToken)
    {
        await _writeLock.WaitAsync(cancellationToken);
        try
        {
            DemoData data;
            lock (_sync)
            {
                data = new DemoData
                {
                    Groups = _groups.Take(_seededGroupCount).ToList(),
                    CheckIns = _checkIns.Append(checkIn).ToList()
                };
            }

            var temporaryPath = _dataPath + ".tmp";
            try
            {
                await using (var stream = File.Create(temporaryPath))
                {
                    await JsonSerializer.SerializeAsync(stream, data, JsonOptions, cancellationToken);
                }

                File.Move(temporaryPath, _dataPath, overwrite: true);
                lock (_sync)
                {
                    _checkIns.Add(checkIn);
                }
            }
            finally
            {
                if (File.Exists(temporaryPath))
                {
                    File.Delete(temporaryPath);
                }
            }
        }
        finally
        {
            _writeLock.Release();
        }
    }

    private void AddUnseededGroups()
    {
        var ids = _groups.Select(group => group.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var districts = new[] { "North", "East", "South", "West" };
        for (var number = 1; _groups.Count < 108; number++)
        {
            var id = $"G{number:000}";
            if (!ids.Add(id))
            {
                continue;
            }

            var districtIndex = (number - 1) / 27;
            _groups.Add(new CellGroup
            {
                Id = id,
                Name = $"{districts[districtIndex]} Cell {number:000}",
                District = districts[districtIndex]
            });
        }
    }
}

internal sealed class DemoData
{
    public List<CellGroup> Groups { get; set; } = [];
    public List<CheckIn> CheckIns { get; set; } = [];
}

internal sealed class CellGroup
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string District { get; set; } = "";
}

internal sealed class CheckIn
{
    public string Id { get; set; } = "";
    public string GroupId { get; set; } = "";
    public string Role { get; set; } = "";
    public string SynthesizedSummary { get; set; } = "";
    public string Transcript { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public string PrimaryDomain { get; set; } = "";
    public double HealthSentiment { get; set; }
    public bool BurnoutFlag { get; set; }

    [JsonIgnore]
    public float[]? Embedding { get; set; }
}

internal sealed class ChatRequest
{
    public string Role { get; set; } = "";
    public string Message { get; set; } = "";
    public List<ChatMessageRequest>? History { get; set; }
}

internal sealed class ChatMessageRequest
{
    public string Role { get; set; } = "";
    public string Content { get; set; } = "";
}

internal sealed class AnalyzeRequest
{
    public string GroupId { get; set; } = "";
    public string Role { get; set; } = "";
    public List<string>? ParticipantResponses { get; set; }
    public string SynthesizedSummary { get; set; } = "";
    public string? Transcript { get; set; }
}

internal sealed class SearchRequest
{
    public string Query { get; set; } = "";
}
