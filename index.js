const express = require("express");
const app = express();
const SSLCommerzPayment = require("sslcommerz");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// console.log(process.env.ACCES_TOKEN)

// console.log(process.env.ACCES_TOKEN)
// console.log(process.env.DB_USER)
// console.log(process.env.DB_PASS)

//middluare
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.crimmms.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri)
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verrifyToken(req, res, next) {
  const authorization = req.headers.authorization;
  // console.log(req.headers.authorization);
  if (!authorization) {
    return res.status(401).send({ message: "unauthorization accss" });
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCES_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }

    req.decoded = decoded;
    next();
  });
  // console.log("authorization");
  // console.log(req.headers.authorization);
}

async function run() {
  try {
    await client.connect();
    //     console.log("database connect");
    const serviceCollection = client
      .db("doctors_portal")
      .collection("services");

    const bookingCollection = client
      .db("doctors_portal")
      .collection("bookings");

    const userCollection = client.db("doctors_portal").collection("users");
    const doctorCollection = client.db("doctors_portal").collection("doctors");
    const paymentCollection = client
      .db("doctors_portal")
      .collection("payments");

    const verrifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const requesterDecodedEmail = await userCollection.findOne({
        email: decodedEmail,
      });
      if (requesterDecodedEmail.role === "admin") {
        next();
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    };

    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query).project({ name: 1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/user", verrifyToken, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.put(
      "/user/admin/:email",
      verrifyToken,
      verrifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        // const decodedEmail = req.decoded.email;
        // const requesterDecodedEmail = await userCollection.findOne({
        //   email: decodedEmail,
        // });
        // if (requesterDecodedEmail.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };

        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
        // }
        // else{

        //   return res.status(403).send({message : "wrong access"})
        // }
      }
    );

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const options = { upsert: true };
      const user = req.body;
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCES_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ result, token });
    });

    app.get("/booking", verrifyToken, async (req, res) => {
      const patient = req.query.patientsEmail;
      const decodedEmail = req.decoded.email;
      if (patient === decodedEmail) {
        const query = { patientsEmail: patient };
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);
      } else {
        return res.status(403).send({ message: "forvifeneen sac" });
      }
    });

    app.get("/avaiable", async (req, res) => {
      const date = req.query.date;
      //step 1 get all the service

      const services = await serviceCollection.find().toArray();
      //step 2 get all the booked service of that day
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();
      //step 3 create foreach for get single service

      services.forEach((service) => {
        // step 4 find booking from match service
        const bookingsMatch = bookings.filter(
          (booked) =>
            // step 5 filtering for singleobject matching both collection and passing a array of object
            booked.treatment === service.name
        );
        //step 6 find ["","",""]
        const currentBooked = bookingsMatch.map((Matchbook) => Matchbook.slot);
        // step 7 make out available service
        const avaiable = service.slots.filter(
          (slot) => !currentBooked.includes(slot)
        );
        service.slots = avaiable;
      });

      res.send(services);
    });

    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patientsEmail: booking.patientsEmail,
      };
      const exits = await bookingCollection.findOne(query);
      if (exits) {
        return res.send({ success: false, booking: exits });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });

    /////doctors
    app.post("/doctors", verrifyToken, verrifyAdmin, async (req, res) => {
      const doctors = req.body;
      const result = await doctorCollection.insertOne(doctors);
      res.send(result);
    });

    app.get("/doctor", verrifyToken, verrifyAdmin, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    });

    app.delete(
      "/doctor/:email",
      verrifyToken,
      verrifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const filter = { email: email };
        const result = await doctorCollection.deleteOne(filter);
        res.send(result);
      }
    );

    app.get("/booking/:id", verrifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
    });

    app.patch("/booking/:id", verrifyToken, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };

      const paymentAdd = await paymentCollection.insertOne(payment);
      const updatingBooking = await bookingCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(updatedDoc);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const service = req.body;
      const price = service.price;
      // console.log(price);
      if (price) {
        const amount = price * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      }
    });

    ////SSL EOMERCE

    app.use("/ssl-request", async (req, res, next) => {
      const data = {
        total_amount: 100,
        currency: "EUR",
        tran_id: "REF123",
        success_url: "http://yoursite.com/success",
        fail_url: "http://yoursite.com/fail",
        cancel_url: "http://yoursite.com/cancel",
        ipn_url: "http://yoursite.com/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: "Customer Name",
        cus_email: "cust@yahoo.com",
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
        multi_card_name: "mastercard",
        value_a: "ref001_A",
        value_b: "ref002_B",
        value_c: "ref003_C",
        value_d: "ref004_D",
      };
      const sslcommer = new SSLCommerzPayment(
        process.env.STORE_ID,
        process.env.STORE_PASSWORD,
        false
      ); //true for live default false for sandbox
      sslcommer.init(data).then((data) => {
        if (data?.GatewayPageURL) {
          return res.status(200).redirect(data?.GatewayPageURL);
        } else {
          return res.status(400).json({
            message: "Ssl session not success",
          });
        }
      });
    });

    app.post("/ssl-payment-suucess", async(req,res,next)=>{


    })
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Doctors Portal World!");
});

app.listen(port, () => {
  console.log(`doctors app listening on port ${port}`);
});
