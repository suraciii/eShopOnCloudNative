using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using Webhooks.API;
using Webhooks.API.Infrastructure;

CreateHostBuilder(args).Build()
    .MigrateDbContext<WebhooksContext>((_, __) => { })
    .Run();


IHostBuilder CreateHostBuilder(string[] args) =>
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(webBuilder =>
        {
            webBuilder
                .UseStartup<Startup>();
        });
