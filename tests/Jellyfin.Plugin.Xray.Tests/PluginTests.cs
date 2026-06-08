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
