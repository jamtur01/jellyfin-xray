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
