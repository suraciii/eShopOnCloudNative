using System.Threading.Tasks;
using System.Net.Http.Json;
using Microsoft.eShopOnContainers.Services.Identity.API.Models;
using Microsoft.eShopOnContainers.Services.Identity.API.Models.Commands;
using Xunit;

namespace Identity.FunctionalTests.Accounts
{
    public class CreateAccountTests : IClassFixture<WAF>
    {
        private readonly WAF _waf;

        public CreateAccountTests(WAF waf)
        {
            this._waf = waf;
        }

        [Fact]
        public async Task CreateAccount()
        {
            var client = _waf.CreateClient();

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
            var reqBody = System.Text.Json.JsonSerializer.Serialize(req);
            res.EnsureSuccessStatusCode();
        }

    }

}