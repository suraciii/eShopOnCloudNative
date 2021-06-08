package basket

import identity.AuthRequest
import io.gatling.core.Predef._
import io.gatling.http.Predef._

import scala.concurrent.duration._

class BasketUpdateSimulation extends Simulation {

  var userSeqFeeder = (1 to 1000).to(LazyList).map(i => Map("userSeq" -> i)).iterator

//  val login = scenario("User Login")
//    .feed(userSeqFeeder)
//    .repeat(1) {
//      AuthRequest.getAccessToken
//    }

  val scn = scenario("Basket Update")
    .feed(userSeqFeeder)
    .repeat(1) {
      exec(AuthRequest.getAccessToken)
        .repeat(60) {
          exec(http("basketUpdate")
            .post("https://eshop.ichnb.com/webshoppingapigw/api/v1/basket/")
            .headers(Map("Authorization" -> "Bearer ${access_token}"))
            .body(StringBody(
              """
            {
                "buyerId": "${userid}",
                "items": [
                    {
                        "id": "7a6a1225-ca45-408b-8fa3-0154c50bf33c",
                        "productId": 6,
                        "productName": ".NET Blue Hoodie",
                        "unitPrice": 12,
                        "oldUnitPrice": 0,
                        "quantity": 1,
                        "pictureUrl": "https://eshop.ichnb.com/webshoppingapigw/c/api/v1/catalog/items/6/pic/"
                    }
                ]
            }
            """.stripMargin)).asJson
          )
        }
    }


  var ip = Seq(
    atOnceUsers(10),
    rampUsers(600).during(80.seconds),
  )

  setUp(
//    login
//      .inject(ip)
//      .andThen(
        scn
          .inject(ip)
//      )
  )
}
