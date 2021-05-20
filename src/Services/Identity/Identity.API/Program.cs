using System;
using System.Linq;
using Microsoft.AspNetCore.Hosting;
using Microsoft.eShopOnContainers.Services.Identity.API;
using Microsoft.Extensions.Hosting;

string Namespace = typeof(Startup).Namespace;
string AppName = Namespace.Substring(Namespace.LastIndexOf('.', Namespace.LastIndexOf('.') - 1) + 1);

bool seed = false;

Console.WriteLine(string.Join(",  ", args));
if (args.Length >= 3 && args[2] == "seed")
{
    seed = true;
    args = args.Skip(1).ToArray();
}

var host = CreateHostBuilder(args).Build();
if (seed)
{
    Console.WriteLine("Run Data Seeding");
    host.Seed();
}
else
{
    Console.WriteLine("Run Web Server");
    host.Run();
}

IHostBuilder CreateHostBuilder(string[] args) =>
    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(webBuilder =>
        {
            webBuilder.UseStartup<Startup>();
        });
