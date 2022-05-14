const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_ADMIN}:${process.env.DB_PASS}@cluster0.6nrjc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
console.log(uri);
 const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

 async function run(){
    try{
        await client.connect()
        const serviceCollection = client.db('doctors_portel').collection('services')
        const bookingCollection = client.db('doctors_portel').collection('booking')

        app.get('/service',async(req,res)=>{
            const query = {}
            const cursor = serviceCollection.find(query)
            const services = await cursor.toArray()
            res.send(services)
        })
        app.get('/available',async(req,res)=>{
            const date = req.query.date;
           
            //step 1
           const services =  await serviceCollection.find().toArray()
           //get the booking of the day output [{} {} {}  {} {}]
           const query = {date:date}
           const bookings = await bookingCollection.find(query).toArray()

           //stap 3 for each service,
           services.forEach(service=>{
             //stap 4find booking for services[{} {} {}  {} {}]
             const serviceBookings =bookings.filter(book=>book.treatment ===service.name)
             //stap 5 selected slots for the services Booking['','','','',]
             const bookedSlots = serviceBookings.map(book=>book.slot)
             // step 6 select thos slots that are not in bookdslots
             const available = service.slots.filter(slot=>!bookedSlots.includes(slot))
             service.slots = available

           })

           //find booking for that servic
           
           res.send(services)
        })

        /**
         * api namming conventrion
         * api(/booking)//get all booking in  this collection. or get more then one  or by filter
         *   
         * 
        */


        app.get('/booking',async (req,res)=>{
          const patient =req.query.patient
          console.log(patient);
          const query = {patient:patient}
          const bookings = await bookingCollection.find(query).toArray()
          res.send(bookings)
        })

         app.post('/booking', async(req,res)=>{
           const booking = req.body;
           const query = {treatment: booking.treatment, date: booking.date,patient:booking.patient}
           const exists = await bookingCollection.findOne(query)
           if(exists){
             return res.send({success:false,booking:exists})
           }
           const result = await bookingCollection.insertOne(booking)
           return res.send({success:true,result})
         })

    }
    finally{

    }
 }run().catch(console.dir)


app.get('/', (req, res) => {
  res.send('Hello')
})

app.listen(port, () => {
  console.log(`doctor app is connected on port ${port}`)
})