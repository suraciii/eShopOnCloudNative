using System;
using System.Linq;
using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.eShopOnContainers.BuildingBlocks.IntegrationEventLogEF;
using Microsoft.eShopOnContainers.Services.Ordering.API;
using Microsoft.eShopOnContainers.Services.Ordering.API.Infrastructure;
using Microsoft.eShopOnContainers.Services.Ordering.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

bool seed = false;
Console.WriteLine(string.Join(",  ", args));
if (args.Length >= 3 && args[2] == "seed")
{
    seed = true;
    args = args.Skip(1).ToArray();
}

var logger = LoggerFactory.Create(logging => logging.AddConsole().SetMinimumLevel(LogLevel.Information)).CreateLogger("Main");
try
{
    var host = CreateHostBuilder(args).Build();

    if (seed)
    {
        logger.LogInformation("Run Data Seeding");
        host.MigrateDbContext<OrderingContext>((context, services) =>
        {
            var env = services.GetService<IWebHostEnvironment>();
            var settings = services.GetService<IOptions<OrderingSettings>>();
            var logger = services.GetService<ILogger<OrderingContextSeed>>();

            new OrderingContextSeed()
                .SeedAsync(context, env, settings, logger)
                .Wait();
        })
        .MigrateDbContext<IntegrationEventLogContext>((_, __) => { });
    }
    else
    {
        logger.LogInformation("Run Web Server");
        host.Run();
    }

}
catch (Exception ex)
{
    logger.LogError(ex, "Startup Failed");
    throw;
}


return 0;

IHostBuilder CreateHostBuilder(string[] args) =>
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(webBuilder =>
        {
            webBuilder
                .ConfigureKestrel(options =>
                {
                    options.Listen(IPAddress.Any, 80, listenOptions =>
                    {
                        listenOptions.Protocols = HttpProtocols.Http1AndHttp2;
                    });

                    options.Listen(IPAddress.Any, 81, listenOptions =>
                    {
                        listenOptions.Protocols = HttpProtocols.Http2;
                    });

                })
            .UseStartup<Startup>();
        });