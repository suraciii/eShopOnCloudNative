using System.Threading.Tasks;
using System.Net.Http.Json;
using Microsoft.eShopOnContainers.Services.Identity.API.Models;
using Microsoft.eShopOnContainers.Services.Identity.API.Models.Commands;
using Xunit;
using System.Collections.Generic;
using System.Net.Http;

namespace Identity.FunctionalTests.Accounts
{
    public class ListAccountTests : IClassFixture<WAF>
    {
        private readonly WAF _waf;

        public ListAccountTests(WAF waf)
        {
            this._waf = waf;
        }

        [Fact]
        public async Task ListAccountsEmpty()
        {
            var client = _waf.CreateClient();

            var res = await client.GetFromJsonAsync<List<AccountListItem>>("/api/v1/Accounts");
            Assert.Empty(res);
        }

        [Fact]
        public async Task ListAccounts()
        {
            var client = _waf.CreateClient();

            await CreateAccount(client);

            var res = await client.GetFromJsonAsync<List<AccountListItem>>("/api/v1/Accounts");
            Assert.Single(res);
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