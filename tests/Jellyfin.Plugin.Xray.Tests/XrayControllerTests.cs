using Jellyfin.Plugin.Xray.Configuration;
using Jellyfin.Plugin.Xray.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Jellyfin.Plugin.Xray.Tests;

public class XrayControllerTests
{
    private static XrayController NewController() =>
        new()
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

    [Fact]
    public void GetScript_ReturnsJavaScriptContentType()
    {
        var result = NewController().GetScript();

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
