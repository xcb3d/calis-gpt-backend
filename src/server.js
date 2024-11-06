import express from 'express'
import cors from 'cors'
import ImageKit from 'imagekit'
import 'dotenv/config'
import mongoose from 'mongoose'
import Chat from '~/models/chat.js'
import UserChats from '~/models/userChats.js'
import contact from './models/contact'
import { clerkMiddleware } from '@clerk/express'

const port = process.env.PORT || 3000
const app = express()

const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY
})

app.use(express.json())

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}))

const connect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'calis-gpt-db'
    })
    // client.db('calis-gpt-db')
    console.log('Connected to MongoDB')
  } catch (error) {
    throw new Error(`Failed to connect to MongoDB: ${error}`)
  }
}

app.get('/api/upload', (req, res) => {
  const result = imagekit.getAuthenticationParameters()
  res.send(result)
})

app.post('/api/chats', async(req, res) => {
  // const userId = req.auth.userId
  const { text, userId } = req.body
  try {
    // Create a new chat document in the database
    const newChat = new Chat({
      userId: userId,
      history: [{
        role: 'user',
        parts: [{
          text: text
        }]
      }]
    })
    const savedChat = await newChat.save()
    //Check if userChat exists
    const userChat = await UserChats.find({
      userId: userId
    })
    // If userChat doesn't exist, create a new userChat document
    if (!userChat.length) {
      // Create a new userChat document in the database
      const newUserChat = new UserChats({
        userId: userId,
        chats: [{
          _id: savedChat._id,
          title: text.substring(0, 40)
        }]
      })
      await newUserChat.save()
    } else {
      // If userChat exists, update the chats array with the new chat
      await UserChats.updateOne(
        { userId: userId },
        { $push: {
          chats: {
            _id: savedChat._id,
            title: text.substring(0, 40)
          }
        }
        }
      )
    }
    res.status(200).json(newChat._id)
  } catch (error) {
    throw new Error(error)
  }
})

app.get('/api/userchats/:userId', async (req, res) => {
  // const userId = req.auth.userId
  const { userId } = req.params
  // console.log("🚀 ~ app.use ~ userId:", req)
  try {
    const userChats = await UserChats.find({ userId: userId })
    // console.log('userChats', userChats)

    if (!userChats) {
      return res.status(404).json({ message: 'User chats not found' })
    }
    if (userChats.length === 0) {
    return res.status(200).json([{_id: '672a61ea7e4b115a4a3a88b1', title: ' ', createAt: '2024-11-05T17:51:25.363Z'}])
    }
    res.status(200).json(userChats[0].chats)
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user chats' })
  }
})

app.get('/api/userchats/:userId/chat/:id', async (req, res) => {
  const { id, userId } = req.params

  try {
    const chat = await Chat.findOne({ userId: userId, _id: id })
    res.status(200).json(chat)
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user chats' })
  }
})

app.put('/api/userchats/chat/:id', async (req, res) => {
  const { userId } = req.body

  const { question, answer, img } = req.body

  const newItems = [
    ...(question
      ? [{ role: 'user', parts: [{ text: question }], ...(img && { img }) }]
      : []),
    { role: 'model', parts: [{ text: answer }] }
  ]

  try {
    const updatedChat = await Chat.updateOne(
      { _id: req.params.id, userId },
      {
        $push: {
          history: {
            $each: newItems
          }
        }
      }
    )
    res.status(200).send(updatedChat)
  } catch (err) {
    res.status(500).send('Error adding conversation!')
  }
})

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body


    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      })
    }

    // Create new contact document
    const newContact = new contact({
      name,
      email,
      message
    })

    // Save to database
    await newContact.save()

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: newContact
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error submitting feedback',
      error: error.message
    })
  }
})

app.use((err, req, res, next) => {
  // const userId = req.auth.userId
  // console.log("🚀 ~ app.use ~ userId:", req)
  res.status(401).send('Unauthenticated!')
})

app.use(clerkMiddleware())

app.listen(port, () => {
  connect()
  console.log(`Server is running on port ${port}`)
})