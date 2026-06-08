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
        Assert.True((bool)payload["requiresAuthentication"]!);
        Assert.Equal("b4e9c1a2-7d3f-4e8a-9c1b-2f6a5d8e3c7b", (string?)payload["pluginId"]);
        Assert.Equal("X-Ray", (string?)payload["pluginName"]);
        Assert.Equal("1.2.3.4", (string?)payload["pluginVersion"]);
    }
}
