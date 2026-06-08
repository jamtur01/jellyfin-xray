using Jellyfin.Plugin.Xray;
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
