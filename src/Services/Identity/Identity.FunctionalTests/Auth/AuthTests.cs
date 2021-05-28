using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.eShopOnContainers.Services.Identity.API.Models;
using Microsoft.eShopOnContainers.Services.Identity.API.Models.Commands;
using Xunit;

namespace Identity.FunctionalTests.Auth
{
    public class AuthTests : IClassFixture<WAF>
    {
        private readonly WAF _waf;

        public AuthTests(WAF waf)
        {
            this._waf = waf;
        }

        [Fact]
        public async Task PasswordFlow()
        {
            var client = _waf.CreateClient();
            await CreateAccount(client);
            await _waf.SeedIdentityServer();

            var content = new FormUrlEncodedContent(new Dictionary<string, string>{
                {"grant_type","password" },
                {"username", "testuser@test.tt"},
                {"password","P@ssw0rd!"},
                {"scope", "openid profile basket"}
            });

            var req = new HttpRequestMessage(HttpMethod.Post, "/connect/token"){
                Content = content
            };
            req.Headers.Authorization= new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", "dGVzdDpzZWNyZXQ=");

            var res = await client.SendAsync(req);
            var result = await res.Content.ReadAsStringAsync();
            res.EnsureSuccessStatusCode();
        }

        private static async Task CreateAccount(HttpClient client)
        {
            var req = new CreateAccountRequest
            {
                Email = "testuser@test.tt",
                Password = "P@ssw0rd!",
                ConfirmPassword = "P@ssw0rd!",
                User = new ApplicationUser
                {
                    CardHolderName = "Test User",
                    CardNumber = "123123",
                    CardType = 0,
                    City = "Revachol",
                    Country = "Revachol",
                    Expiration = "11/23",
                    LastName = "User",
                    Name = "Test",
                    Street = "Unknown",
                    State = "Revachol",
                    ZipCode = "123123",
                    PhoneNumber = "123123",
                    SecurityNumber = "123"
                }
            };

            var res = await client.PostAsJsonAsync("/api/v1/Accounts", req);
            res.EnsureSuccessStatusCode();
        }
    }

}