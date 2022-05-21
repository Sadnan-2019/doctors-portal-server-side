const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

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

    app.get("/service", async (rew, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
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
            // step 5 filtering for sigleobject matching both collection and passing a array of object
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
