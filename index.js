const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 3000;
// const stripe = require("stripe")(process.env.STRIPE_KEY);

//middleware
app.use(cors());
app.use(express.json());
require("colors");
//database uri
const uri = `${process.env.DB_URL}`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function dbConnect() {
  try {
    await client.connect();
    console.log("Database connected".yellow);
  } catch (error) {
    console.log(error.name.bgRed, error.message.bold);
  }
}
dbConnect();

//jwt middleware function
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(403).send("Unauthorized access");
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

//run function
async function run() {
  try {
    const database = client.db("b612-resale-product-assignment_db")
    const usersCollection = database.collection("users");
    const cartCollection = database.collection("carts");
    const categoryCollection = database.collection("categoryData");
    const productsCollection = database.collection("products");
    const blogCollection = database.collection("questionAndAnswer");
    const paymentsCollection = database.collection("payments");

    // jwt access token
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { user_email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "6h",
        });
        return res.send({ accessToken: token });
      }
      console.log(user);
      res.status(403).send({ accessToken: "" });
    });

    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //payment method implement
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = parseInt(price) * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //get method for checking admin in useAdmin hook
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { user_email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    //get method for checking seller in useSeller hook
    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { user_email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.type === "Seller" });
    });

    //get method for checking buyer in useBuyer hook
    app.get("/users/buyer/:email", async (req, res) => {
      const email = req.params.email;
      const query = { user_email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isBuyer: user?.type === "Buyer" });
    });

    //get question and answer
    app.get("/questions", async (req, res) => {
      const query = {};
      const result = await blogCollection.find(query).toArray();
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //get three category items
    app.get("/categories", async (req, res) => {
      const query = {};
      const result = await categoryCollection.find(query).toArray();
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //get a product by id
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const productsById = await productsCollection.findOne(query);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: productsById,
      });
    });

    //get products by email
    app.get("/product/:email", async (req, res) => {
      const email = req.params.email;
      const query = { product_email: email };
      const cursor = productsCollection.find(query);
      const productsByEmail = await cursor.toArray();
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: productsByEmail,
      });
    });

    //get method for booking product

    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { buyer_email: email };
      const booking = await cartCollection.find(query).toArray();
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: booking,
      });
    });
    //get method for orders product
    app.get("/orders", async (req, res) => {
      const email = req.query.email;
      const query = { buyer_email: email };
      const booking = await cartCollection.find(query).toArray();
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: booking,
      });
    });

    //get booking items by id
    app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.findOne(query);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //get users by get method
    app.get("/users", async (req, res) => {
      // const user = req.body;
      const query = {};
      const allUser = await usersCollection.find(query).toArray();
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: allUser,
      });
    });

    //get products for advertising in home
    app.get("/products", async (req, res) => {
      const query = {};
      const products = await productsCollection.find(query).toArray();
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: products,
      });
    });

    //delete method for delete user from allUsers
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //delete order from my order
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(filter);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //delete method single person product
    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(filter);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //post method for post products
    app.post("/add-product", async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //post method for users information
    app.post("/add-user", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //payments history post method
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updateResult = await cartCollection.updateOne(filter, updateDoc);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //put method for upsert and make admin
    app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //put method for verified seller
    app.put("/users/verify/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          verified: true,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //put method for ad items true
    app.put("/product/add/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ad: true,
        },
      };
      const result = await productsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //post methods for booking items
    app.post("/carts", async (req, res) => {
      const booking = req.body;
      const result = await cartCollection.insertOne(booking);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });
  } finally {
  }
}
run().catch(console.error());

app.get("/", async (req, res) => {
  res.send("Resale products running");
});

app.listen(port, () => {
  console.log(`Resale products running on port : ${port}`);
});