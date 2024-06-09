const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 3000;
// const port = process.env.PORT || 7771;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

// Middleware
// app.use(cors());
app.use(
  cors({
    origin: true,
    optionsSuccessStatus: 200,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  })
);
// const corsOptions = {
//   origin: "https://b612-final-assingment.web.app"
// };

// app.use(cors({
//   origin: "http://localhost:5173",
//   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
//   credentials: true,
// }))
// app.use(cors({ origin: 'https://b612-final-assingment.web.app' }))

// const corsOptions = {
//   origin: 'https://b612-final-assingment.web.app',
//   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
//   allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
// };

// app.use(cors(corsOptions));





// const corsConfig = {
//   origin: '*',
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
// }
// app.use(cors(corsConfig))







app.use(express.json());
require("colors");

// Database URI
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
    //console.log("Database connected".yellow);
  } catch (error) {
    //console.log(error.name.bgRed, error.message.bold);
  }
}
dbConnect();

// JWT middleware function
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(403).send("Unauthorized access");
  }

  const token = authHeader.split(" ")[1];
  //console.log("🚀 ~ verifyJWT ~ token:", token)
  jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const database = client.db("b612-resale-product-assignment_db");
    const usersCollection = database.collection("users");
    const cartCollection = database.collection("carts");
    const orderCollection = database.collection("orders");
    const productsCollection = database.collection("products")
    const paymentsCollection = database.collection("payments");

    // Authentication Endpoints

    // JWT access token
    app.post("/jwt", (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, { expiresIn: '1h' })
      res.send({ token })
    })
    // Middleware to verify admin
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { user_email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // Payment Endpoints

    // Payment method implementation
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

    // User Endpoints

    // Get method for checking admin in useAdmin hook
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { user_email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    // Get method for checking seller in useSeller hook
    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { user_email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.user_accountType === "Seller" });
    });

    // Get method for checking buyer in useBuyer hook
    app.get("/users/buyer/:email", async (req, res) => {
      const email = req.params.email;
      const query = { user_email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isBuyer: user?.user_accountType === "Buyer" });
    });

    // Get all users
    app.get("/all-users", async (req, res) => {
      const query = {};
      const allUser = await usersCollection.find(query).toArray();
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: allUser,
      });
    });
    // Get seller users
    app.get("/sellers", async (req, res) => {
      const query = { user_accountType: "Seller" };
      const seller = await usersCollection.find(query).toArray();
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: seller,
      });
    });
    // Get buyer users
    app.get("/my-buyers", async (req, res) => {
      const email = req.query.email;
      const query = { buyer_email: email };
      const buyer = await usersCollection.find(query).toArray();
      //console.log("🚀 ~ app.get ~ query:", query)
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: buyer,
      });
    });

    // Add new user
    app.post("/add-user", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    // Delete user
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

    // Update user role to admin
    app.patch("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc, options);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    // Verify seller
    app.patch("/users/verify/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          verified: true,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc, options);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    // Product Endpoints

    // Get a product by ID
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const productsById = await productsCollection.findOne(query);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: productsById,
      });
    });
    // Get a product by category
    app.get("/products-category/:category", async (req, res) => {
      const category = req.params.category;
      const query = { product_category: category };
      const productsByCategory = await productsCollection.find(query).toArray();
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: productsByCategory,
      });
    });

    // Get products by email
    app.get("/products-email/:email", async (req, res) => {
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

    // Get all products
    app.get("/products", async (req, res) => {
      const query = {};
      const products = await productsCollection.find(query).toArray();;
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: products,
      });
    });
    //get products by paginating
    app.get("/products-by-paginating", async (req, res) => {
      let page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const query = {};
      const cursor = productsCollection.find(query);
      let skipNumber = page * size;
      const count = await productsCollection.estimatedDocumentCount();
      if (skipNumber >= count) {
        skipNumber = 0;
      }
      const products = await cursor.skip(skipNumber).limit(size).toArray();;
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: { count, data: products },
      });
    });
    //get reported items
    app.get("/products-reported", async (req, res) => {
      const query = { reported: true };
      const products = await productsCollection.find(query).toArray();;
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: products,
      });
    });
    // get ad products
    app.get("/products-ad", async (req, res) => {
      const query = { ad: true };
      const products = await productsCollection.find(query).toArray();;
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: products,
      });
    });
    // Add new product
    app.post("/add-product", async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });


    // Delete a product by ID
    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(filter);
      //console.log("🚀 ~ app.delete ~ result:", result)
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    //add a product to report
    app.patch("/product/report/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          reported: true,
        },
      };
      const result = await productsCollection.updateOne(filter, updateDoc, options);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });
    // Mark a product as advertised
    app.patch("/product/ad/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ad: true,
        },
      };
      const result = await productsCollection.updateOne(filter, updateDoc, options);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });
    // Cart Endpoints

    // Get all booking items by email
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

    // Get booking item by ID
    app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.findOne(query);
      //console.log("🚀 ~ app.get ~ query:", query)
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    });

    // Add new booking item
    app.put("/carts", async (req, res) => {
      const booking = req.body;
      // const query = { _id: booking. };
      // const document = await cartCollection.findOne(query);
      // if (document) {

      //   res.send({
      //     status: true,
      //     message: "Successfully got the data",
      //     data: "Product already in cart ",
      //   });

      // }
      const result = await cartCollection.insertOne(booking);
      const addToOrder = await orderCollection.insertOne(booking);
      res.send({
        status: true,
        message: "Successfully inserted the data",
        data: result,
      });
    });

    // Delete booking item by ID
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

    // Order Endpoints

    // Get all orders by email
    app.get("/orders", async (req, res) => {
      const email = req.query.email;
      const query = { buyer_email: email };
      const orders = await orderCollection.find(query).toArray();
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: orders,
      });
    });

    // Payment Endpoints

    // Add payment information

    app.get('/payments/:email', verifyJWT, async (req, res) => {
      const query = { buyerEmail: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      console.log("🚀 ~ app.get ~ query:", query)
      const result = await paymentsCollection.find(query).toArray();
      console.log("🚀 ~ app.get ~ result:", result)
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: result,
      });
    })
    //get buyer information from payment
    // app.get('/all-payments', verifyJWT, async (req, res) => {
    //   const query = {};
    //   const result = await paymentsCollection.find(query).toArray();
    //   // console.log("🚀 ~ app.get ~ result:", result)
    //   res.send({
    //     status: true,
    //     massage: "Successfully got the data",
    //     data: result,
    //   });
    // })

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      console.log("🚀 ~ app.post ~ payment:", payment)
      const paymentResult = await paymentsCollection.insertOne(payment);
      console.log('payment info', payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      };
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const orderUpdate = await orderCollection.updateMany(query, updateDoc);
      const deleteResult = await cartCollection.deleteMany(query);
      res.send({
        status: true,
        massage: "Successfully got the data",
        data: { paymentResult, deleteResult },
      });
    });
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      //console.log("🚀 ~ app.post ~ price:", price)
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })
  } finally {
    // Ensuring that the client will close when you finish/error
  }
}
run().catch(console.error);

// Root endpoint
app.get("/", async (req, res) => {
  res.send("Use ME running");
});

// Start server
app.listen(port, () => {
  //console.log(`Use ME running on port: ${port}`);
});
