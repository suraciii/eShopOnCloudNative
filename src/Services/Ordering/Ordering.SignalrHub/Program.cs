using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using Ordering.SignalrHub;

var host = CreateHostBuilder(args).Build();
host.Run();

return 0;

IHostBuilder CreateHostBuilder(string[] args) =>
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(webBuilder =>
        {
            webBuilder
                .UseStartup<Startup>();
        });