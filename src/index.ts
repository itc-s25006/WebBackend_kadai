import express from "express";
const app = express()

app.get('/api/health',(req,res) => {
  res.status(200).json({"status":"ok"})
})

app.listen(3000,() => {
  console.log('Start server port:3000')

}
)

