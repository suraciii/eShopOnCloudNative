package identity

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class AccountRegisterSimulation extends Simulation {

  val httpProtocol = http
    .baseUrl("https://eshop.ichnb.com/identity") // Here is the root for all relative URLs

  var userIdFeeder = (1002 to 2000).to(LazyList).map(i => Map("userId" -> i)).iterator

  val scn = scenario("userCreate") // A scenario is a chain of requests and pauses
    .feed(userIdFeeder)
    .repeat(1){
      exec(http("userCreate") // Here's an example of a POST request
        .post("/api/v1/accounts")
        .body(StringBody(
          """
          {
            "Email": "testuser-${userId}@test.tt",
            "Password": "P@ssw0rd!",
            "ConfirmPassword": "P@ssw0rd!",
            "User": {
            "CardNumber": "123123",
            "SecurityNumber": "123",
            "Expiration": "11/23",
            "CardHolderName": "Test User",
            "CardType": 0,
            "Street": "Unknown",
            "City": "Revachol",
            "State": "Revachol",
            "Country": "Revachol",
            "ZipCode": "123123",
            "Name": "Test",
            "LastName": "User${userId}",
            "PhoneNumber": "123123"
            }
          }""")).asJson
      )
    }

  setUp(scn.inject(
    atOnceUsers(999), // 2
//    rampUsers(100).during(300.seconds),
  ).protocols(httpProtocol))
}
