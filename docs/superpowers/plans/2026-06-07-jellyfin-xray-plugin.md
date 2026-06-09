# X-Ray for Jellyfin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Jellyfin plugin that adds an "X-Ray" button to the web video player which opens an overlay listing the cast (actors + guest stars) with character names and headshots, plus title/episode context.

**Architecture:** A minimal C# server plugin (net9.0) serves a client JS bundle via an API controller and registers a tiny loader script with the JavaScript Injector plugin (by reflection). The injected loader fetches the bundle, which adds the player button and renders the overlay using the browser's `window.ApiClient`.

**Tech Stack:** C# / .NET 9, Jellyfin.Controller/Model 10.11.x, xUnit, Newtonsoft.Json (for the injector payload); client JS as ES modules bundled with esbuild, tested with vitest + jsdom; JPRM for packaging.

---

## Conventions for this plan

- **Plugin GUID (use verbatim everywhere):** `b4e9c1a2-7d3f-4e8a-9c1b-2f6a5d8e3c7b`
- **Root namespace / assembly:** `Jellyfin.Plugin.Xray`
- **Commits:** this repo is colocated jj+git. Commit with `jj commit -m "..."` (finalizes the current change and starts a new one). Run it from the repo root.
- **Working directory:** repo root is `/Users/james/src/xray`.
- **Run dotnet/npm from the directories shown in each task.**

## File structure (created across the plan)

```
xray.sln
Jellyfin.Plugin.Xray/
  Jellyfin.Plugin.Xray.csproj
  Plugin.cs                          # BasePlugin + IHasWebPages
  PluginServiceRegistrator.cs        # DI: registers the hosted service + InjectorClient
  Configuration/
    PluginConfiguration.cs           # IncludeGuestStars, MaxCast, ButtonIcon
    configPage.html                  # dashboard settings + injector status
  Services/
    InjectorClient.cs                # reflection wrapper over the injector PluginInterface
    LoaderPayload.cs                 # builds the JObject payload for RegisterScript
    XrayRegistrationService.cs       # IHostedService: register on start, unregister on stop
  Controllers/
    XrayController.cs                 # GET /XRay/script, GET /XRay/config
  Web/
    loader.js                        # embedded; registered with the injector
    src/
      index.js                       # bootstrap: wires observer -> data -> panel
      observer.js                    # MutationObserver, injects the OSD button
      data.js                        # item id from hash, fetch item, headshot url
      format.js                      # selectCast, contextHeader (pure)
      panel.js                       # build/teardown overlay, cast cards
      xray.css                       # imported as text by index.js
      format.test.js
      data.test.js
      panel.test.js
      observer.test.js
    dist/
      xray.js                        # esbuild output; embedded resource
  package.json                       # esbuild + vitest
  vitest.config.js
tests/
  Jellyfin.Plugin.Xray.Tests/
    Jellyfin.Plugin.Xray.Tests.csproj
    PluginTests.cs
    InjectorClientTests.cs
    LoaderPayloadTests.cs
    XrayControllerTests.cs
    FakeInjector.cs
build.yaml                           # JPRM build descriptor
manifest.json                        # plugin repository manifest
.github/workflows/build.yaml         # node build -> dotnet -> jprm -> release
README.md
icon.png
```

---

## Task 1: Solution and project scaffold

**Files:**
- Create: `xray.sln`
- Create: `Jellyfin.Plugin.Xray/Jellyfin.Plugin.Xray.csproj`
- Create: `tests/Jellyfin.Plugin.Xray.Tests/Jellyfin.Plugin.Xray.Tests.csproj`

- [ ] **Step 1: Verify the .NET 9 SDK is present**

Run: `dotnet --list-sdks`
Expected: a line beginning with `9.` (e.g. `9.0.xxx`). If absent, install the .NET 9 SDK before continuing.

- [ ] **Step 2: Create the plugin csproj**

Create `Jellyfin.Plugin.Xray/Jellyfin.Plugin.Xray.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <RootNamespace>Jellyfin.Plugin.Xray</RootNamespace>
    <AssemblyName>Jellyfin.Plugin.Xray</AssemblyName>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <GenerateAssemblyInfo>true</GenerateAssemblyInfo>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Jellyfin.Controller" Version="10.11.3">
      <ExcludeAssets>runtime</ExcludeAssets>
    </PackageReference>
    <PackageReference Include="Jellyfin.Model" Version="10.11.3">
      <ExcludeAssets>runtime</ExcludeAssets>
    </PackageReference>
    <!--
      Newtonsoft is provided by the Jellyfin server in the default load context.
      ExcludeAssets=runtime keeps our copy OUT of the plugin package so our JObject
      shares type identity with the JavaScript Injector's JObject across load
      contexts; otherwise the reflection RegisterScript(JObject) call throws a type
      mismatch. Version 13.0.1 matches what the injector compiled against.
    -->
    <PackageReference Include="Newtonsoft.Json" Version="13.0.1">
      <ExcludeAssets>runtime</ExcludeAssets>
    </PackageReference>
  </ItemGroup>

  <ItemGroup>
    <EmbeddedResource Include="Configuration\configPage.html" />
    <EmbeddedResource Include="Web\loader.js" />
    <EmbeddedResource Include="Web\dist\xray.js" />
  </ItemGroup>

</Project>
```

Note: `Web\dist\xray.js` does not exist yet; it is produced in Task 13. The csproj will not build until then, so Task 1's build check below targets the test project only.

- [ ] **Step 3: Create the test csproj**

Create `tests/Jellyfin.Plugin.Xray.Tests/Jellyfin.Plugin.Xray.Tests.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.11.1" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
    <!-- The plugin excludes Newtonsoft at runtime, so the test project needs its own copy. -->
    <PackageReference Include="Newtonsoft.Json" Version="13.0.1" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\Jellyfin.Plugin.Xray\Jellyfin.Plugin.Xray.csproj" />
  </ItemGroup>

</Project>
```

- [ ] **Step 4: Create the solution and add both projects**

Run from repo root:
```bash
dotnet new sln -n xray
dotnet sln add Jellyfin.Plugin.Xray/Jellyfin.Plugin.Xray.csproj
dotnet sln add tests/Jellyfin.Plugin.Xray.Tests/Jellyfin.Plugin.Xray.Tests.csproj
```
Expected: "Project ... added to the solution." twice.

- [ ] **Step 5: Add a .gitignore section for build output**

Append to the existing `.gitignore` (it already covers `bin/`/`obj/`); add the JS artifacts:
```
# JS tooling
node_modules/
Jellyfin.Plugin.Xray/Web/dist/
```

- [ ] **Step 6: Create placeholder embedded-resource files so the project builds**

The `.csproj` declares `EmbeddedResource` entries for files that later tasks fill in.
MSBuild errors on a missing embedded-resource file, so create minimal placeholders
now (later tasks overwrite them):

```bash
mkdir -p Jellyfin.Plugin.Xray/Configuration Jellyfin.Plugin.Xray/Web/dist
printf '<!DOCTYPE html><html><body></body></html>\n' > Jellyfin.Plugin.Xray/Configuration/configPage.html
printf '// placeholder\n' > Jellyfin.Plugin.Xray/Web/loader.js
printf '// placeholder\n' > Jellyfin.Plugin.Xray/Web/dist/xray.js
```

Note: `Web/dist/` is gitignored, so the `dist/xray.js` placeholder will not be
committed; that is fine — it only needs to exist locally for the build. Verify the
solution restores and builds:

Run: `dotnet build`
Expected: Build succeeded.

- [ ] **Step 7: Commit**

```bash
jj commit -m "Scaffold solution, plugin and test projects"
```

---

## Task 2: PluginConfiguration

**Files:**
- Create: `Jellyfin.Plugin.Xray/Configuration/PluginConfiguration.cs`
- Test: `tests/Jellyfin.Plugin.Xray.Tests/PluginTests.cs`

- [ ] **Step 1: Write the failing test**

Create `tests/Jellyfin.Plugin.Xray.Tests/PluginTests.cs`:

```csharp
using Jellyfin.Plugin.Xray.Configuration;
using Xunit;

namespace Jellyfin.Plugin.Xray.Tests;

public class PluginConfigurationTests
{
    [Fact]
    public void Defaults_AreSensible()
    {
        var config = new PluginConfiguration();

        Assert.True(config.IncludeGuestStars);
        Assert.Equal(50, config.MaxCast);
        Assert.Equal("people", config.ButtonIcon);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test tests/Jellyfin.Plugin.Xray.Tests --filter PluginConfigurationTests`
Expected: build FAIL — `PluginConfiguration` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `Jellyfin.Plugin.Xray/Configuration/PluginConfiguration.cs`:

```csharp
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.Xray.Configuration;

/// <summary>Settings for the X-Ray plugin.</summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>Gets or sets a value indicating whether guest stars are shown alongside actors.</summary>
    public bool IncludeGuestStars { get; set; } = true;

    /// <summary>Gets or sets the maximum number of cast members shown in the panel.</summary>
    public int MaxCast { get; set; } = 50;

    /// <summary>Gets or sets the Material Icons glyph name used for the player button.</summary>
    public string ButtonIcon { get; set; } = "people";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test tests/Jellyfin.Plugin.Xray.Tests --filter PluginConfigurationTests`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
jj commit -m "Add plugin configuration with defaults"
```

---

## Task 3: Plugin class and config page wiring

**Files:**
- Create: `Jellyfin.Plugin.Xray/Plugin.cs`
- Create: `Jellyfin.Plugin.Xray/Configuration/configPage.html` (minimal now; filled in Task 12)
- Test: `tests/Jellyfin.Plugin.Xray.Tests/PluginTests.cs` (extend)

- [ ] **Step 1: Add a minimal config page so the embedded resource exists**

Create `Jellyfin.Plugin.Xray/Configuration/configPage.html`:

```html
<!DOCTYPE html>
<html>
<head><title>X-Ray</title></head>
<body>
  <div id="XrayConfigPage" data-role="page" class="page type-interior pluginConfigurationPage">
    <div data-role="content"><div class="content-primary"></div></div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Write the failing test**

Append to `tests/Jellyfin.Plugin.Xray.Tests/PluginTests.cs`:

```csharp
public class PluginMetadataTests
{
    [Fact]
    public void GetPages_ReturnsConfigPageResource()
    {
        var resourceName = "Jellyfin.Plugin.Xray.Configuration.configPage.html";
        var stream = typeof(Plugin).Assembly.GetManifestResourceStream(resourceName);

        Assert.NotNull(stream);
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `dotnet test tests/Jellyfin.Plugin.Xray.Tests --filter PluginMetadataTests`
Expected: build FAIL — `Plugin` does not exist.

- [ ] **Step 4: Write minimal implementation**

Create `Jellyfin.Plugin.Xray/Plugin.cs`:

```csharp
using System.Globalization;
using Jellyfin.Plugin.Xray.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.Xray;

/// <summary>The X-Ray plugin entry point.</summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    /// <summary>Initializes a new instance of the <see cref="Plugin"/> class.</summary>
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    /// <summary>Gets the current plugin instance.</summary>
    public static Plugin? Instance { get; private set; }

    /// <inheritdoc />
    public override string Name => "X-Ray";

    /// <inheritdoc />
    public override Guid Id => Guid.Parse("b4e9c1a2-7d3f-4e8a-9c1b-2f6a5d8e3c7b");

    /// <inheritdoc />
    public override string Description =>
        "Shows cast, character names and headshots in an overlay during playback.";

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages() =>
    [
        new PluginPageInfo
        {
            Name = Name,
            EmbeddedResourcePath = string.Format(
                CultureInfo.InvariantCulture,
                "{0}.Configuration.configPage.html",
                GetType().Namespace)
        }
    ];
}
```

Note: building the plugin project still requires `Web/dist/xray.js`. To run this test before Task 13, temporarily allow the build by creating an empty placeholder once: `mkdir -p Jellyfin.Plugin.Xray/Web/dist && printf '// placeholder\n' > Jellyfin.Plugin.Xray/Web/dist/xray.js`. (Task 13 replaces it with the real build and removes the need.)

- [ ] **Step 5: Run test to verify it passes**

Run: `dotnet test tests/Jellyfin.Plugin.Xray.Tests --filter PluginMetadataTests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
jj commit -m "Add Plugin class with config page registration"
```

---

## Task 4: InjectorClient (reflection wrapper)

**Files:**
- Create: `Jellyfin.Plugin.Xray/Services/InjectorClient.cs`
- Create: `tests/Jellyfin.Plugin.Xray.Tests/FakeInjector.cs`
- Test: `tests/Jellyfin.Plugin.Xray.Tests/InjectorClientTests.cs`

- [ ] **Step 1: Write the fake injector and failing test**

Create `tests/Jellyfin.Plugin.Xray.Tests/FakeInjector.cs`:

```csharp
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.Xray.Tests;

/// <summary>Mimics the JavaScript Injector's public static PluginInterface for reflection tests.</summary>
public static class FakeInjectorPluginInterface
{
    public static JObject? LastRegistered { get; set; }
    public static string? LastUnregisteredPluginId { get; set; }

    public static bool RegisterScript(JObject payload)
    {
        LastRegistered = payload;
        return true;
    }

    public static int UnregisterAllScriptsFromPlugin(string pluginId)
    {
        LastUnregisteredPluginId = pluginId;
        return 1;
    }
}
```

Create `tests/Jellyfin.Plugin.Xray.Tests/InjectorClientTests.cs`:

```csharp
using Jellyfin.Plugin.Xray.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Jellyfin.Plugin.Xray.Tests;

public class InjectorClientTests
{
    private static InjectorClient WithFakeInjector() =>
        new(NullLogger<InjectorClient>.Instance, () => typeof(FakeInjectorPluginInterface));

    [Fact]
    public void RegisterScript_InvokesReflectedMethod_WithPayload()
    {
        FakeInjectorPluginInterface.LastRegistered = null;
        var payload = new JObject { ["id"] = "xray-loader", ["script"] = "x();" };

        var ok = WithFakeInjector().RegisterScript(payload);

        Assert.True(ok);
        Assert.NotNull(FakeInjectorPluginInterface.LastRegistered);
        Assert.Equal("xray-loader", (string?)FakeInjectorPluginInterface.LastRegistered!["id"]);
    }

    [Fact]
    public void UnregisterAll_InvokesReflectedMethod()
    {
        FakeInjectorPluginInterface.LastUnregisteredPluginId = null;

        var ok = WithFakeInjector().UnregisterAll("plugin-guid");

        Assert.True(ok);
        Assert.Equal("plugin-guid", FakeInjectorPluginInterface.LastUnregisteredPluginId);
    }

    [Fact]
    public void RegisterScript_ReturnsFalse_WhenInjectorAbsent()
    {
        var client = new InjectorClient(NullLogger<InjectorClient>.Instance, () => null);

        var ok = client.RegisterScript(new JObject { ["id"] = "x" });

        Assert.False(ok);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test tests/Jellyfin.Plugin.Xray.Tests --filter InjectorClientTests`
Expected: build FAIL — `InjectorClient` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `Jellyfin.Plugin.Xray/Services/InjectorClient.cs`:

```csharp
using System.Reflection;
using System.Runtime.Loader;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.Xray.Services;

/// <summary>Talks to the JavaScript Injector plugin via reflection, with no compile-time dependency.</summary>
public sealed class InjectorClient
{
    private const string InterfaceTypeName = "Jellyfin.Plugin.JavaScriptInjector.PluginInterface";
    private readonly ILogger<InjectorClient> _logger;
    private readonly Func<Type?> _resolveInterface;

    /// <summary>Initializes a new instance of the <see cref="InjectorClient"/> class.</summary>
    public InjectorClient(ILogger<InjectorClient> logger)
        : this(logger, DefaultResolve)
    {
    }

    /// <summary>Initializes a new instance with a custom interface resolver (used by tests).</summary>
    public InjectorClient(ILogger<InjectorClient> logger, Func<Type?> resolveInterface)
    {
        _logger = logger;
        _resolveInterface = resolveInterface;
    }

    /// <summary>Gets a value indicating whether the injector plugin is loaded.</summary>
    public bool IsAvailable => _resolveInterface() is not null;

    /// <summary>Registers a script payload with the injector. Returns false if the injector is absent.</summary>
    public bool RegisterScript(JObject payload) =>
        Invoke("RegisterScript", new object[] { payload }) is true;

    /// <summary>Removes all scripts previously registered by the given plugin id.</summary>
    public bool UnregisterAll(string pluginId) =>
        Invoke("UnregisterAllScriptsFromPlugin", new object[] { pluginId }) is not null;

    private object? Invoke(string method, object[] args)
    {
        var type = _resolveInterface();
        if (type is null)
        {
            _logger.LogWarning(
                "JavaScript Injector plugin not found; X-Ray cannot inject its script. Install it to enable X-Ray.");
            return null;
        }

        var info = type.GetMethod(method, BindingFlags.Public | BindingFlags.Static);
        if (info is null)
        {
            _logger.LogError("JavaScript Injector method {Method} not found; injector version too old.", method);
            return null;
        }

        try
        {
            return info.Invoke(null, args);
        }
        catch (TargetInvocationException ex)
        {
            _logger.LogError(ex.InnerException, "JavaScript Injector {Method} threw.", method);
            return null;
        }
    }

    private static Type? DefaultResolve() =>
        AssemblyLoadContext.All
            .SelectMany(context => context.Assemblies)
            .FirstOrDefault(a => a.FullName?.Contains("Jellyfin.Plugin.JavaScriptInjector", StringComparison.Ordinal) ?? false)
            ?.GetType(InterfaceTypeName);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test tests/Jellyfin.Plugin.Xray.Tests --filter InjectorClientTests`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
jj commit -m "Add InjectorClient reflection wrapper"
```

---

## Task 5: LoaderPayload builder

**Files:**
- Create: `Jellyfin.Plugin.Xray/Services/LoaderPayload.cs`
- Create: `Jellyfin.Plugin.Xray/Web/loader.js`
- Test: `tests/Jellyfin.Plugin.Xray.Tests/LoaderPayloadTests.cs`

- [ ] **Step 1: Create the loader script (embedded resource)**

Create `Jellyfin.Plugin.Xray/Web/loader.js`:

```javascript
(function () {
  function load() {
    if (!window.ApiClient || typeof ApiClient.getUrl !== 'function') {
      window.setTimeout(load, 500);
      return;
    }
    if (document.getElementById('xray-bundle')) {
      return;
    }
    var script = document.createElement('script');
    script.id = 'xray-bundle';
    script.src = ApiClient.getUrl('XRay/script') + '?v=' + Date.now();
    script.defer = true;
    document.body.appendChild(script);
  }
  load();
})();
```

- [ ] **Step 2: Write the failing test**

Create `tests/Jellyfin.Plugin.Xray.Tests/LoaderPayloadTests.cs`:

```csharp
using Jellyfin.Plugin.Xray.Services;
using Xunit;

namespace Jellyfin.Plugin.Xray.Tests;

public class LoaderPayloadTests
{
    [Fact]
    public void Build_HasRequiredInjectorFields()
    {
        var payload = LoaderPayload.Build("console.log('x');", "1.2.3.4");

        Assert.Equal("xray-loader", (string?)payload["id"]);
        Assert.Equal("X-Ray", (string?)payload["name"]);
        Assert.Equal("console.log('x');", (string?)payload["script"]);
        Assert.True((bool)payload["enabled"]!);
        Assert.Equal("b4e9c1a2-7d3f-4e8a-9c1b-2f6a5d8e3c7b", (string?)payload["pluginId"]);
        Assert.Equal("X-Ray", (string?)payload["pluginName"]);
        Assert.Equal("1.2.3.4", (string?)payload["pluginVersion"]);
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `dotnet test tests/Jellyfin.Plugin.Xray.Tests --filter LoaderPayloadTests`
Expected: build FAIL — `LoaderPayload` does not exist.

- [ ] **Step 4: Write minimal implementation**

Create `Jellyfin.Plugin.Xray/Services/LoaderPayload.cs`:

```csharp
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.Xray.Services;

/// <summary>Builds the JObject payload accepted by the JavaScript Injector's RegisterScript.</summary>
public static class LoaderPayload
{
    /// <summary>The stable script id; reused so registration is idempotent.</summary>
    public const string ScriptId = "xray-loader";

    /// <summary>The X-Ray plugin GUID as a string.</summary>
    public const string PluginId = "b4e9c1a2-7d3f-4e8a-9c1b-2f6a5d8e3c7b";

    /// <summary>Builds the registration payload for the given loader script body and plugin version.</summary>
    public static JObject Build(string script, string pluginVersion) => new()
    {
        ["id"] = ScriptId,
        ["name"] = "X-Ray",
        ["script"] = script,
        ["enabled"] = true,
        ["requiresAuthentication"] = true,
        ["pluginId"] = PluginId,
        ["pluginName"] = "X-Ray",
        ["pluginVersion"] = pluginVersion
    };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `dotnet test tests/Jellyfin.Plugin.Xray.Tests --filter LoaderPayloadTests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
jj commit -m "Add loader script and injector payload builder"
```

---

## Task 6: XrayRegistrationService (IHostedService) and DI wiring

**Files:**
- Create: `Jellyfin.Plugin.Xray/Services/XrayRegistrationService.cs`
- Create: `Jellyfin.Plugin.Xray/PluginServiceRegistrator.cs`

(No new unit test: this is glue over already-tested units; it is exercised by the manual checklist. Keep it thin.)

- [ ] **Step 1: Create the hosted service**

Create `Jellyfin.Plugin.Xray/Services/XrayRegistrationService.cs`:

```csharp
using System.Reflection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Xray.Services;

/// <summary>Registers the X-Ray loader with the JavaScript Injector on startup and removes it on shutdown.</summary>
public sealed class XrayRegistrationService : IHostedService
{
    private readonly InjectorClient _injector;
    private readonly ILogger<XrayRegistrationService> _logger;

    /// <summary>Initializes a new instance of the <see cref="XrayRegistrationService"/> class.</summary>
    public XrayRegistrationService(InjectorClient injector, ILogger<XrayRegistrationService> logger)
    {
        _injector = injector;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0.0";
        var loader = ReadLoaderResource();
        var payload = LoaderPayload.Build(loader, version);

        if (_injector.RegisterScript(payload))
        {
            _logger.LogInformation("X-Ray loader registered with the JavaScript Injector.");
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        _injector.UnregisterAll(LoaderPayload.PluginId);
        return Task.CompletedTask;
    }

    private static string ReadLoaderResource()
    {
        using var stream = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream("Jellyfin.Plugin.Xray.Web.loader.js")
            ?? throw new InvalidOperationException("Embedded loader.js resource missing.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
```

- [ ] **Step 2: Create the service registrator**

Create `Jellyfin.Plugin.Xray/PluginServiceRegistrator.cs`:

```csharp
using Jellyfin.Plugin.Xray.Services;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.Xray;

/// <summary>Registers X-Ray services into the Jellyfin DI container.</summary>
public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddSingleton<InjectorClient>();
        serviceCollection.AddHostedService<XrayRegistrationService>();
    }
}
```

- [ ] **Step 3: Build to verify it compiles**

Run: `dotnet build Jellyfin.Plugin.Xray/Jellyfin.Plugin.Xray.csproj`
Expected: Build succeeded, 0 warnings (the placeholder `Web/dist/xray.js` from Task 3 satisfies the embed).

- [ ] **Step 4: Commit**

```bash
jj commit -m "Register loader on startup via hosted service"
```

---

## Task 7: XrayController (serve script + config)

**Files:**
- Create: `Jellyfin.Plugin.Xray/Controllers/XrayController.cs`
- Test: `tests/Jellyfin.Plugin.Xray.Tests/XrayControllerTests.cs`

- [ ] **Step 1: Write the failing test**

Create `tests/Jellyfin.Plugin.Xray.Tests/XrayControllerTests.cs`:

```csharp
using Jellyfin.Plugin.Xray.Configuration;
using Jellyfin.Plugin.Xray.Controllers;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Jellyfin.Plugin.Xray.Tests;

public class XrayControllerTests
{
    [Fact]
    public void GetScript_ReturnsJavaScriptContentType()
    {
        var result = new XrayController().GetScript();

        var file = Assert.IsType<FileStreamResult>(result);
        Assert.Equal("application/javascript", file.ContentType);
    }

    [Fact]
    public void GetConfig_ReturnsConfigValues()
    {
        var config = new PluginConfiguration { IncludeGuestStars = false, MaxCast = 7, ButtonIcon = "groups" };

        var result = XrayController.BuildConfigDto(config);

        Assert.False(result.IncludeGuestStars);
        Assert.Equal(7, result.MaxCast);
        Assert.Equal("groups", result.ButtonIcon);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test tests/Jellyfin.Plugin.Xray.Tests --filter XrayControllerTests`
Expected: build FAIL — `XrayController` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `Jellyfin.Plugin.Xray/Controllers/XrayController.cs`:

```csharp
using System.Reflection;
using Jellyfin.Plugin.Xray.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.Xray.Controllers;

/// <summary>Serves the X-Ray client bundle and its runtime configuration.</summary>
[ApiController]
[Route("XRay")]
public class XrayController : ControllerBase
{
    /// <summary>The client-facing subset of plugin configuration.</summary>
    public sealed record ConfigDto(bool IncludeGuestStars, int MaxCast, string ButtonIcon);

    /// <summary>Serves the bundled client JavaScript.</summary>
    [HttpGet("script")]
    [AllowAnonymous]
    [Produces("application/javascript")]
    public ActionResult GetScript()
    {
        var stream = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream("Jellyfin.Plugin.Xray.Web.dist.xray.js");
        if (stream is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "public, max-age=86400";
        return File(stream, "application/javascript");
    }

    /// <summary>Serves the client configuration as JSON.</summary>
    [HttpGet("config")]
    [AllowAnonymous]
    public ActionResult<ConfigDto> GetConfig() =>
        BuildConfigDto(Plugin.Instance?.Configuration ?? new PluginConfiguration());

    /// <summary>Maps plugin configuration to the client DTO (extracted for testing).</summary>
    public static ConfigDto BuildConfigDto(PluginConfiguration config) =>
        new(config.IncludeGuestStars, config.MaxCast, config.ButtonIcon);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test tests/Jellyfin.Plugin.Xray.Tests --filter XrayControllerTests`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
jj commit -m "Add controller serving client bundle and config"
```

---

## Task 8: JS toolchain scaffold

**Files:**
- Create: `Jellyfin.Plugin.Xray/package.json`
- Create: `Jellyfin.Plugin.Xray/vitest.config.js`

- [ ] **Step 1: Create package.json**

Create `Jellyfin.Plugin.Xray/package.json`:

```json
{
  "name": "jellyfin-plugin-xray-web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "esbuild src/index.js --bundle --format=iife --minify --loader:.css=text --outfile=dist/xray.js",
    "test": "vitest run"
  },
  "devDependencies": {
    "esbuild": "0.24.0",
    "jsdom": "25.0.1",
    "vitest": "2.1.4"
  }
}
```

- [ ] **Step 2: Create vitest config**

Create `Jellyfin.Plugin.Xray/vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js']
  }
});
```

- [ ] **Step 3: Install dependencies**

Run from `Jellyfin.Plugin.Xray/`:
```bash
npm install
```
Expected: `node_modules/` created; no errors.

- [ ] **Step 4: Commit**

```bash
jj commit -m "Add JS build and test toolchain"
```

---

## Task 9: format.js (pure helpers)

**Files:**
- Create: `Jellyfin.Plugin.Xray/Web/src/format.js`
- Test: `Jellyfin.Plugin.Xray/Web/src/format.test.js`

- [ ] **Step 1: Write the failing tests**

Create `Jellyfin.Plugin.Xray/Web/src/format.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { selectCast, contextHeader } from './format.js';

describe('selectCast', () => {
  const people = [
    { Name: 'A', Type: 'Actor' },
    { Name: 'D', Type: 'Director' },
    { Name: 'G', Type: 'GuestStar' }
  ];

  it('includes actors and guest stars by default', () => {
    expect(selectCast(people).map((p) => p.Name)).toEqual(['A', 'G']);
  });

  it('excludes guest stars when disabled', () => {
    expect(selectCast(people, { includeGuestStars: false }).map((p) => p.Name)).toEqual(['A']);
  });

  it('caps the list at max', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ Name: `A${i}`, Type: 'Actor' }));
    expect(selectCast(many, { max: 2 })).toHaveLength(2);
  });

  it('tolerates missing People', () => {
    expect(selectCast(undefined)).toEqual([]);
  });
});

describe('contextHeader', () => {
  it('formats an episode', () => {
    const item = { Type: 'Episode', SeriesName: 'The Bear', ParentIndexNumber: 2, IndexNumber: 4, Name: 'Honeydew' };
    expect(contextHeader(item)).toBe("The Bear · S2 E4 · ‘Honeydew’");
  });

  it('formats a movie with year', () => {
    expect(contextHeader({ Type: 'Movie', Name: 'Heat', ProductionYear: 1995 })).toBe('Heat (1995)');
  });

  it('returns empty string for nullish item', () => {
    expect(contextHeader(null)).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `Jellyfin.Plugin.Xray/`: `npm test -- format`
Expected: FAIL — cannot resolve `./format.js`.

- [ ] **Step 3: Write minimal implementation**

Create `Jellyfin.Plugin.Xray/Web/src/format.js`:

```javascript
const CAST_TYPES_WITH_GUESTS = ['Actor', 'GuestStar'];
const CAST_TYPES_ACTORS = ['Actor'];

export function selectCast(people, options = {}) {
  if (!Array.isArray(people)) {
    return [];
  }
  const { includeGuestStars = true, max = 50 } = options;
  const types = includeGuestStars ? CAST_TYPES_WITH_GUESTS : CAST_TYPES_ACTORS;
  return people.filter((person) => types.includes(person.Type)).slice(0, max);
}

export function contextHeader(item) {
  if (!item) {
    return '';
  }
  if (item.Type === 'Episode') {
    const season = item.ParentIndexNumber != null ? `S${item.ParentIndexNumber}` : '';
    const episode = item.IndexNumber != null ? `E${item.IndexNumber}` : '';
    const seasonEpisode = [season, episode].filter(Boolean).join(' ');
    const title = item.Name ? `‘${item.Name}’` : '';
    return [item.SeriesName, seasonEpisode, title].filter(Boolean).join(' · ');
  }
  const year = item.ProductionYear ? ` (${item.ProductionYear})` : '';
  return `${item.Name || ''}${year}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `Jellyfin.Plugin.Xray/`: `npm test -- format`
Expected: PASS (7 assertions across the suites).

- [ ] **Step 5: Commit**

```bash
jj commit -m "Add cast selection and context header helpers"
```

---

## Task 10: data.js (hash, fetch, headshot URL)

**Files:**
- Create: `Jellyfin.Plugin.Xray/Web/src/data.js`
- Test: `Jellyfin.Plugin.Xray/Web/src/data.test.js`

- [ ] **Step 1: Write the failing tests**

Create `Jellyfin.Plugin.Xray/Web/src/data.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { currentItemId, headshotUrl, fetchItem } from './data.js';

describe('currentItemId', () => {
  it('reads the id from a video hash', () => {
    expect(currentItemId('#/video?id=abc123&foo=1')).toBe('abc123');
  });

  it('returns null without a query', () => {
    expect(currentItemId('#/home')).toBeNull();
  });
});

describe('headshotUrl', () => {
  it('builds a primary image url with a fresh options object', () => {
    const apiClient = { getImageUrl: vi.fn(() => 'http://x/img') };
    const person = { Id: 'p1', PrimaryImageTag: 'tag1' };

    const url = headshotUrl(apiClient, person);

    expect(url).toBe('http://x/img');
    expect(apiClient.getImageUrl).toHaveBeenCalledWith('p1', {
      type: 'Primary',
      tag: 'tag1',
      maxHeight: 150
    });
  });

  it('returns null when there is no headshot', () => {
    const apiClient = { getImageUrl: vi.fn() };
    expect(headshotUrl(apiClient, { Id: 'p1', PrimaryImageTag: null })).toBeNull();
    expect(apiClient.getImageUrl).not.toHaveBeenCalled();
  });
});

describe('fetchItem', () => {
  it('fetches with the current user id', async () => {
    const apiClient = {
      getCurrentUserId: vi.fn(() => 'user1'),
      getItem: vi.fn(async () => ({ Id: 'i1' }))
    };

    const item = await fetchItem(apiClient, 'i1');

    expect(item.Id).toBe('i1');
    expect(apiClient.getItem).toHaveBeenCalledWith('user1', 'i1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `Jellyfin.Plugin.Xray/`: `npm test -- data`
Expected: FAIL — cannot resolve `./data.js`.

- [ ] **Step 3: Write minimal implementation**

Create `Jellyfin.Plugin.Xray/Web/src/data.js`:

```javascript
export function currentItemId(hash = window.location.hash) {
  const queryStart = (hash || '').indexOf('?');
  if (queryStart === -1) {
    return null;
  }
  return new URLSearchParams(hash.substring(queryStart + 1)).get('id');
}

export function headshotUrl(apiClient, person, options = {}) {
  if (!person || !person.PrimaryImageTag) {
    return null;
  }
  // getImageUrl mutates its options object, so pass a fresh literal each call.
  return apiClient.getImageUrl(person.Id, {
    type: 'Primary',
    tag: person.PrimaryImageTag,
    maxHeight: options.maxHeight || 150
  });
}

export async function fetchItem(apiClient, itemId) {
  const userId = apiClient.getCurrentUserId();
  return apiClient.getItem(userId, itemId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `Jellyfin.Plugin.Xray/`: `npm test -- data`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
jj commit -m "Add client data helpers (hash, fetch, headshot url)"
```

---

## Task 11: panel.js (overlay DOM)

**Files:**
- Create: `Jellyfin.Plugin.Xray/Web/src/panel.js`
- Test: `Jellyfin.Plugin.Xray/Web/src/panel.test.js`

- [ ] **Step 1: Write the failing tests**

Create `Jellyfin.Plugin.Xray/Web/src/panel.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPanel } from './panel.js';

const apiClient = { getImageUrl: () => 'http://x/img' };
const item = { Type: 'Movie', Name: 'Heat', ProductionYear: 1995 };
const cast = [
  { Id: 'p1', Name: 'Al Pacino', Role: 'Hanna', Type: 'Actor', PrimaryImageTag: 't1' },
  { Id: 'p2', Name: 'Extra', Role: '', Type: 'Actor', PrimaryImageTag: null }
];

beforeEach(() => {
  document.body.innerHTML = '';
  window.location.hash = '';
});

describe('buildPanel', () => {
  it('renders the header and one card per cast member', () => {
    const panel = buildPanel({ item, cast, apiClient });

    expect(panel.querySelector('.xray-header').textContent).toContain('Heat (1995)');
    expect(panel.querySelectorAll('.xray-card')).toHaveLength(2);
    expect(panel.querySelector('.xray-card .xray-name').textContent).toBe('Al Pacino');
    expect(panel.querySelector('.xray-card .xray-role').textContent).toBe('Hanna');
  });

  it('shows an initials placeholder when there is no headshot', () => {
    const panel = buildPanel({ item, cast, apiClient });
    const second = panel.querySelectorAll('.xray-card')[1];
    expect(second.querySelector('img')).toBeNull();
    expect(second.querySelector('.xray-initials').textContent).toBe('E');
  });

  it('navigates to the person page on card click', () => {
    const panel = buildPanel({ item, cast, apiClient });
    panel.querySelector('.xray-card').click();
    expect(window.location.hash).toBe('#/details?id=p1');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    const panel = buildPanel({ item, cast, apiClient, onClose });
    panel.querySelector('.xray-close').click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows an empty message when there is no cast', () => {
    const panel = buildPanel({ item, cast: [], apiClient });
    expect(panel.querySelector('.xray-empty').textContent).toContain('No cast information');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `Jellyfin.Plugin.Xray/`: `npm test -- panel`
Expected: FAIL — cannot resolve `./panel.js`.

- [ ] **Step 3: Write minimal implementation**

Create `Jellyfin.Plugin.Xray/Web/src/panel.js`:

```javascript
import { contextHeader } from './format.js';
import { headshotUrl } from './data.js';

function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

function buildCard(person, apiClient) {
  const card = document.createElement('button');
  card.className = 'xray-card';
  card.type = 'button';

  const url = headshotUrl(apiClient, person);
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = person.Name || '';
    img.loading = 'lazy';
    card.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'xray-initials';
    placeholder.textContent = initials(person.Name);
    card.appendChild(placeholder);
  }

  const name = document.createElement('div');
  name.className = 'xray-name';
  name.textContent = person.Name || '';
  card.appendChild(name);

  const role = document.createElement('div');
  role.className = 'xray-role';
  role.textContent = person.Role || '';
  card.appendChild(role);

  card.addEventListener('click', () => {
    window.location.hash = `#/details?id=${person.Id}`;
  });

  return card;
}

export function buildPanel({ item, cast, apiClient, onClose }) {
  const panel = document.createElement('div');
  panel.className = 'xray-panel';

  const close = document.createElement('button');
  close.className = 'xray-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Close X-Ray');
  close.textContent = '✕';
  close.addEventListener('click', () => onClose && onClose());
  panel.appendChild(close);

  const header = document.createElement('div');
  header.className = 'xray-header';
  header.textContent = contextHeader(item);
  panel.appendChild(header);

  if (!cast || cast.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'xray-empty';
    empty.textContent = 'No cast information available for this title.';
    panel.appendChild(empty);
    return panel;
  }

  const list = document.createElement('div');
  list.className = 'xray-list';
  for (const person of cast) {
    list.appendChild(buildCard(person, apiClient));
  }
  panel.appendChild(list);

  return panel;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `Jellyfin.Plugin.Xray/`: `npm test -- panel`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
jj commit -m "Add overlay panel rendering"
```

---

## Task 12: observer.js (OSD button injection)

**Files:**
- Create: `Jellyfin.Plugin.Xray/Web/src/observer.js`
- Test: `Jellyfin.Plugin.Xray/Web/src/observer.test.js`

- [ ] **Step 1: Write the failing tests**

Create `Jellyfin.Plugin.Xray/Web/src/observer.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureButton } from './observer.js';

beforeEach(() => {
  document.body.innerHTML = `
    <div class="videoOsdBottom">
      <div class="buttons focuscontainer-x">
        <button class="btnVideoOsdSettings"></button>
      </div>
    </div>`;
});

describe('ensureButton', () => {
  it('inserts the X-Ray button before the settings button', () => {
    ensureButton(document, vi.fn(), 'people');

    const buttons = document.querySelector('.videoOsdBottom .buttons');
    const xray = buttons.querySelector('.btnXray');
    expect(xray).not.toBeNull();
    expect(xray.nextElementSibling.classList.contains('btnVideoOsdSettings')).toBe(true);
  });

  it('does not insert a second button', () => {
    ensureButton(document, vi.fn(), 'people');
    ensureButton(document, vi.fn(), 'people');

    expect(document.querySelectorAll('.btnXray')).toHaveLength(1);
  });

  it('invokes the click handler', () => {
    const onClick = vi.fn();
    ensureButton(document, onClick, 'people');

    document.querySelector('.btnXray').click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does nothing when the OSD is absent', () => {
    document.body.innerHTML = '<div></div>';
    ensureButton(document, vi.fn(), 'people');
    expect(document.querySelector('.btnXray')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `Jellyfin.Plugin.Xray/`: `npm test -- observer`
Expected: FAIL — cannot resolve `./observer.js`.

- [ ] **Step 3: Write minimal implementation**

Create `Jellyfin.Plugin.Xray/Web/src/observer.js`:

```javascript
const BUTTON_CLASS = 'btnXray';

export function ensureButton(root, onClick, icon) {
  const buttons = root.querySelector('.videoOsdBottom .buttons.focuscontainer-x');
  if (!buttons || buttons.querySelector(`.${BUTTON_CLASS}`)) {
    return;
  }
  const settings = buttons.querySelector('.btnVideoOsdSettings');

  const button = document.createElement('button');
  button.setAttribute('is', 'paper-icon-button-light');
  button.className = `${BUTTON_CLASS} autoSize`;
  button.title = 'X-Ray';
  button.innerHTML = `<span class="xlargePaperIconButton material-icons ${icon}" aria-hidden="true"></span>`;
  button.addEventListener('click', onClick);

  if (settings) {
    settings.parentElement.insertBefore(button, settings);
  } else {
    buttons.appendChild(button);
  }
}

export function startObserver(onClick, icon) {
  const tryInject = () => ensureButton(document, onClick, icon);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length || mutation.removedNodes.length) {
        tryInject();
        return;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  tryInject();
  return observer;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `Jellyfin.Plugin.Xray/`: `npm test -- observer`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
jj commit -m "Add OSD button injection with dedupe"
```

---

## Task 13: index.js bootstrap, CSS, and the real bundle

**Files:**
- Create: `Jellyfin.Plugin.Xray/Web/src/xray.css`
- Create: `Jellyfin.Plugin.Xray/Web/src/index.js`
- Modify: replace placeholder `Jellyfin.Plugin.Xray/Web/dist/xray.js` with the real build

- [ ] **Step 1: Create the stylesheet**

Create `Jellyfin.Plugin.Xray/Web/src/xray.css`:

```css
.xray-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: min(420px, 90vw);
  height: 100%;
  z-index: 1000;
  background: rgba(20, 20, 20, 0.92);
  color: #fff;
  padding: 3em 1.25em 1.25em;
  box-sizing: border-box;
  overflow-y: auto;
  backdrop-filter: blur(8px);
}
.xray-close {
  position: absolute;
  top: 0.75em;
  right: 0.75em;
  background: transparent;
  border: 0;
  color: #fff;
  font-size: 1.3em;
  cursor: pointer;
}
.xray-header {
  font-size: 1.05em;
  font-weight: 600;
  margin-bottom: 1em;
}
.xray-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 0.85em;
}
.xray-card {
  background: transparent;
  border: 0;
  color: inherit;
  text-align: center;
  cursor: pointer;
  padding: 0;
}
.xray-card img,
.xray-initials {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  object-fit: cover;
  margin: 0 auto 0.4em;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #444;
  font-size: 1.8em;
}
.xray-name { font-weight: 600; font-size: 0.85em; }
.xray-role { opacity: 0.75; font-size: 0.8em; }
.xray-empty { opacity: 0.8; }
```

- [ ] **Step 2: Create the bootstrap entry point**

Create `Jellyfin.Plugin.Xray/Web/src/index.js`:

```javascript
import css from './xray.css';
import { startObserver } from './observer.js';
import { currentItemId, fetchItem } from './data.js';
import { selectCast } from './format.js';
import { buildPanel } from './panel.js';

const DEFAULT_CONFIG = { includeGuestStars: true, maxCast: 50, buttonIcon: 'people' };
let config = DEFAULT_CONFIG;
let currentPanel = null;

function injectStyles() {
  if (document.getElementById('xray-styles')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'xray-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

function closePanel() {
  if (currentPanel) {
    currentPanel.remove();
    currentPanel = null;
    document.removeEventListener('keydown', onKeydown);
  }
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    closePanel();
  }
}

async function openPanel() {
  if (currentPanel) {
    closePanel();
    return;
  }
  const itemId = currentItemId();
  if (!itemId) {
    return;
  }
  let item;
  try {
    item = await fetchItem(window.ApiClient, itemId);
  } catch {
    item = null;
  }
  const cast = selectCast(item && item.People, {
    includeGuestStars: config.includeGuestStars,
    max: config.maxCast
  });
  const host = document.querySelector('.videoOsdBottom')?.parentElement || document.body;
  currentPanel = buildPanel({ item, cast, apiClient: window.ApiClient, onClose: closePanel });
  host.appendChild(currentPanel);
  document.addEventListener('keydown', onKeydown);
}

async function loadConfig() {
  try {
    const response = await fetch(window.ApiClient.getUrl('XRay/config'));
    if (response.ok) {
      const dto = await response.json();
      config = {
        includeGuestStars: dto.IncludeGuestStars,
        maxCast: dto.MaxCast,
        buttonIcon: dto.ButtonIcon
      };
    }
  } catch {
    config = DEFAULT_CONFIG;
  }
}

(async function init() {
  injectStyles();
  await loadConfig();
  startObserver(openPanel, config.buttonIcon);
})();
```

- [ ] **Step 3: Build the bundle**

Run from `Jellyfin.Plugin.Xray/`:
```bash
npm run build
```
Expected: `dist/xray.js` written (minified, single file). This overwrites the Task 3 placeholder.

- [ ] **Step 4: Verify the full JS suite still passes**

Run from `Jellyfin.Plugin.Xray/`: `npm test`
Expected: PASS (all suites: format, data, panel, observer).

- [ ] **Step 5: Rebuild the plugin against the real bundle**

Run from repo root: `dotnet build Jellyfin.Plugin.Xray/Jellyfin.Plugin.Xray.csproj`
Expected: Build succeeded, 0 warnings.

- [ ] **Step 6: Commit**

```bash
jj commit -m "Add bootstrap, styles and produce client bundle"
```

---

## Task 14: Config page UI

**Files:**
- Modify: `Jellyfin.Plugin.Xray/Configuration/configPage.html`

- [ ] **Step 1: Replace the minimal page with the full settings page**

Replace the contents of `Jellyfin.Plugin.Xray/Configuration/configPage.html`:

```html
<!DOCTYPE html>
<html>
<head><title>X-Ray</title></head>
<body>
  <div id="XrayConfigPage" data-role="page" class="page type-interior pluginConfigurationPage">
    <div data-role="content">
      <div class="content-primary">
        <div id="xrayInjectorStatus" style="margin: 1em 0;"></div>
        <form id="XrayConfigForm">
          <div class="checkboxContainer checkboxContainer-withDescription">
            <label>
              <input is="emby-checkbox" type="checkbox" id="IncludeGuestStars" />
              <span>Include guest stars</span>
            </label>
          </div>
          <div class="inputContainer">
            <label class="inputLabel inputLabelUnfocused" for="MaxCast">Maximum cast shown</label>
            <input is="emby-input" type="number" id="MaxCast" min="1" max="200" />
          </div>
          <div class="inputContainer">
            <label class="inputLabel inputLabelUnfocused" for="ButtonIcon">Button icon (Material Icons name)</label>
            <input is="emby-input" type="text" id="ButtonIcon" />
          </div>
          <button is="emby-button" type="submit" class="raised button-submit block">
            <span>Save</span>
          </button>
        </form>
      </div>
    </div>
    <script type="text/javascript">
      (function () {
        var pluginId = 'b4e9c1a2-7d3f-4e8a-9c1b-2f6a5d8e3c7b';
        var page = document;

        function loadStatus() {
          fetch(ApiClient.getUrl('XRay/config'))
            .then(function (r) { return r.ok; })
            .then(function (ok) {
              page.querySelector('#xrayInjectorStatus').textContent = ok
                ? 'X-Ray is serving its client script.'
                : 'X-Ray script endpoint not reachable.';
            });
        }

        document.querySelector('#XrayConfigPage').addEventListener('pageshow', function () {
          Dashboard.showLoadingMsg();
          ApiClient.getPluginConfiguration(pluginId).then(function (config) {
            page.querySelector('#IncludeGuestStars').checked = config.IncludeGuestStars;
            page.querySelector('#MaxCast').value = config.MaxCast;
            page.querySelector('#ButtonIcon').value = config.ButtonIcon;
            Dashboard.hideLoadingMsg();
            loadStatus();
          });
        });

        document.querySelector('#XrayConfigForm').addEventListener('submit', function (e) {
          e.preventDefault();
          Dashboard.showLoadingMsg();
          ApiClient.getPluginConfiguration(pluginId).then(function (config) {
            config.IncludeGuestStars = page.querySelector('#IncludeGuestStars').checked;
            config.MaxCast = parseInt(page.querySelector('#MaxCast').value, 10);
            config.ButtonIcon = page.querySelector('#ButtonIcon').value;
            ApiClient.updatePluginConfiguration(pluginId, config).then(function (result) {
              Dashboard.processPluginConfigurationUpdateResult(result);
            });
          });
          return false;
        });
      })();
    </script>
  </div>
</body>
</html>
```

- [ ] **Step 2: Rebuild to confirm the embedded resource compiles in**

Run from repo root: `dotnet build Jellyfin.Plugin.Xray/Jellyfin.Plugin.Xray.csproj`
Expected: Build succeeded, 0 warnings.

- [ ] **Step 3: Commit**

```bash
jj commit -m "Add settings config page"
```

---

## Task 15: Packaging (build.yaml, manifest.json)

**Files:**
- Create: `build.yaml`
- Create: `manifest.json`

- [ ] **Step 1: Create the JPRM build descriptor**

Create `build.yaml`:

```yaml
---
name: "X-Ray"
guid: "b4e9c1a2-7d3f-4e8a-9c1b-2f6a5d8e3c7b"
version: "1.0.0.0"
targetAbi: "10.11.0.0"
framework: "net9.0"
owner: "jamesturnbull"
overview: "Cast and character overlay during playback."
description: >
  Adds an X-Ray button to the Jellyfin web player that opens an overlay listing
  the cast (actors and guest stars) with character names and headshots, plus
  title and episode context. Requires the JavaScript Injector plugin.
category: "General"
artifacts:
  - "Jellyfin.Plugin.Xray.dll"
changelog: >
  ### 1.0.0.0
  - Initial release.
```

- [ ] **Step 2: Create the repository manifest (checksum/timestamp filled by CI in Task 16)**

Create `manifest.json`:

```json
[
  {
    "guid": "b4e9c1a2-7d3f-4e8a-9c1b-2f6a5d8e3c7b",
    "name": "X-Ray",
    "description": "Adds an X-Ray button to the Jellyfin web player showing cast, character names and headshots during playback.",
    "overview": "Cast and character overlay during playback.",
    "owner": "jamesturnbull",
    "category": "General",
    "imageUrl": "https://raw.githubusercontent.com/jamesturnbull/jellyfin-plugin-xray/main/icon.png",
    "versions": []
  }
]
```

- [ ] **Step 3: Verify JPRM can build the package locally**

Run from repo root (requires `pip install --user jprm` and Node deps installed):
```bash
cd Jellyfin.Plugin.Xray && npm ci && npm run build && cd ..
jprm plugin build . --output ./artifacts
```
Expected: a `Jellyfin.Plugin.Xray_1.0.0.0.zip` appears under `./artifacts`. (If `jprm` is unavailable in the environment, skip the run and rely on CI in Task 16; note this in the commit message.)

- [ ] **Step 3a: Verify Newtonsoft is NOT bundled**

The injector integration only works if our `JObject` shares type identity with the
server's shared Newtonsoft. Confirm the package ships only our DLL:
```bash
unzip -l artifacts/Jellyfin.Plugin.Xray_1.0.0.0.zip
```
Expected: lists `Jellyfin.Plugin.Xray.dll` and **no** `Newtonsoft.Json.dll`. If
Newtonsoft is present, the `ExcludeAssets>runtime` on the Newtonsoft reference in
Task 1 is missing or wrong — fix before continuing.

- [ ] **Step 4: Commit**

```bash
jj commit -m "Add JPRM build descriptor and repository manifest"
```

---

## Task 16: CI workflow

**Files:**
- Create: `.github/workflows/build.yaml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/build.yaml`:

```yaml
name: Build plugin

on:
  push:
    branches: [main]
  release:
    types: [released]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"

      - name: Build client bundle
        working-directory: Jellyfin.Plugin.Xray
        run: |
          npm ci
          npm run build
          npm test

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "9.0.x"

      - name: Run .NET tests
        run: dotnet test --configuration Release

      - name: Build plugin package
        uses: oddstr13/jellyfin-plugin-repository-manager@v1.1.1
        id: jprm
        with:
          dotnet-target: "net9.0"

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: plugin
          path: ${{ steps.jprm.outputs.artifact }}

      - name: Attach to release
        if: github.event_name == 'release'
        uses: softprops/action-gh-release@v2
        with:
          files: ${{ steps.jprm.outputs.artifact }}
```

- [ ] **Step 2: Commit**

```bash
jj commit -m "Add CI workflow building client and plugin"
```

Note for release: after the first GitHub release publishes the zip, append a `versions[]` entry to `manifest.json` with `version`, `targetAbi: "10.11.0.0"`, the release-asset `sourceUrl`, the zip's MD5 `checksum`, and a `timestamp`. JPRM's `--output-manifest` can generate this entry; commit the updated `manifest.json`.

---

## Task 17: README and icon

**Files:**
- Create: `README.md`
- Create: `icon.png`

- [ ] **Step 1: Write the README**

Create `README.md`:

```markdown
# Jellyfin X-Ray

Adds an **X-Ray** button to the Jellyfin web video player. Clicking it opens an
overlay that lists the cast — actors and guest stars — with character names and
headshots, plus the title and (for episodes) season/episode context. Clicking a
cast member opens their page in Jellyfin.

## Requirements

- Jellyfin **10.11.x**.
- The **JavaScript Injector** plugin
  (`n00bcodr/Jellyfin-JavaScript-Injector`, v3.1.0.0 or later). X-Ray uses it to
  load its client script. Without it, the button will not appear.

## Install

1. In Jellyfin: **Dashboard → Plugins → Repositories → Add**, and add the X-Ray
   repository manifest URL.
2. Install **JavaScript Injector** and **X-Ray** from the catalog.
3. Restart Jellyfin and refresh the web client.

## Configuration

**Dashboard → Plugins → X-Ray:**

- **Include guest stars** — show guest stars alongside the main cast.
- **Maximum cast shown** — cap the number of people in the overlay.
- **Button icon** — the Material Icons glyph used for the player button.

## How it works

X-Ray is a small server plugin that serves a JavaScript bundle and registers a
loader with the JavaScript Injector. The bundle adds the player button and uses
the browser's authenticated API client to fetch the playing item's cast and
images — no machine learning and no per-item preprocessing.

## Development

```bash
# Client bundle + JS tests
cd Jellyfin.Plugin.Xray && npm ci && npm run build && npm test

# .NET build + tests
dotnet test
```
```

- [ ] **Step 2: Add an icon**

Create a 256×256 PNG named `icon.png` at the repo root. Generate one with any tool; for a quick placeholder using ImageMagick:
```bash
magick -size 256x256 xc:'#101010' -gravity center -fill white \
  -pointsize 110 -annotate 0 'XR' icon.png
```
Expected: `icon.png` exists at the repo root (256×256). Replace with a designed icon before public release.

- [ ] **Step 3: Commit**

```bash
jj commit -m "Add README and plugin icon"
```

---

## Final verification

- [ ] **Step 1: Full build and tests green**

Run from repo root:
```bash
cd Jellyfin.Plugin.Xray && npm ci && npm run build && npm test && cd ..
dotnet test --configuration Release
```
Expected: JS suites pass; .NET tests pass; 0 warnings.

- [ ] **Step 2: Manual smoke test (deploy locally)**

Build and copy the plugin into a local Jellyfin (10.11.x) plugins directory, install the JavaScript Injector, restart, and verify against this checklist:
- Bare-metal and Docker installs.
- A movie: button appears in the player; overlay shows title + year and cast with headshots.
- An episode: header shows `Series · S# E# · ‘Title’`.
- A title with no cast: overlay shows "No cast information available."
- An actor with no headshot: initials placeholder, no broken image.
- A custom theme: overlay is readable.
- Mobile width: overlay is usable.
- TV layout: the button is reachable with D-pad navigation.
- Clicking a cast member opens that person's page.
- The JavaScript Injector uninstalled: the button does not appear and the server log shows the X-Ray warning, with the plugin otherwise healthy.

---

## Spec coverage check

- Cast = actors + guest stars → Task 9 (`selectCast`), Task 13 (config wiring).
- Character names + headshots → Task 11 (`buildPanel`), Task 10 (`headshotUrl`).
- Title/episode context → Task 9 (`contextHeader`).
- Click person → Jellyfin page → Task 11 (card click → `#/details`).
- Overlay while playing, no pause → Task 13 (panel appended; playback untouched).
- Delivery via JavaScript Injector by reflection → Tasks 4–6.
- Serve bundle + config via controller → Task 7.
- Config page → Task 14.
- net9.0 / 10.11.x packaging, JPRM + manifest → Tasks 1, 15, 16.
- Error handling (injector absent, empty cast, missing headshot, dedupe) → Tasks 4, 11, 12, 13.
- Tests (C# + JS) → Tasks 2–7 (C#), 9–12 (JS).
- Public release (README, icon) → Task 17.
```

