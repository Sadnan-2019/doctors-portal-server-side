const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

require("dotenv").config();
const jwt = require("jsonwebtoken");

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


    const verrifyAdmin = async(req,res,next)=>{

   
      const decodedEmail = req.decoded.email;
      const requesterDecodedEmail = await userCollection.findOne({
        email: decodedEmail,
      });
      if (requesterDecodedEmail.role === "admin") {
        next();

      }else{
        return res.status(403).send({message : "forbidden access"})

      }


    }

    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query).project({name: 1});
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/user", verrifyToken, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });


app.get("/admin/:email", async(req,res)=>{

  const email = req.params.email;
  const user = await userCollection.findOne({email:email});
  const isAdmin = user.role === "admin";
  res.send({admin:isAdmin})
})

    app.put("/user/admin/:email", verrifyToken,verrifyAdmin, async (req, res) => {
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
     
    });

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


    /////doctors
    app.post("/doctors",verrifyToken, verrifyAdmin, async (req,res) =>{

      const doctors = req.body;
      const result = await doctorCollection.insertOne(doctors);
      res.send(result);

    })



    // app.get("/doctors",verrifyToken,verrifyAdmin, async(req, res) =>{

    //   const doctors = await doctorCollection.find().toArray();
    //   // const users = await userCollection.find().toArray();
    //   res.send(doctors)
    //   // res.send(users);
    // })

    app.get("/doctor", verrifyToken, verrifyAdmin, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    });
  } 
  
  finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Doctors Portal World!");
});

app.listen(port, () => {
  console.log(`doctors app listening on port ${port}`);
});
