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


      app.get("/service",async(rew,res)=>{
          const query={};
          const cursor = serviceCollection.find(query);
          const result = await cursor.toArray();
          res.send(result)


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
