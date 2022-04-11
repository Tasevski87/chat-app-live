const { AuthenticationError } = require("apollo-server-express");
const { User, Message, Chat } = require("../models");
const { signToken } = require("../utils/auth");

const resolvers = {
  Query: {
    me: async (parent, args, context) => {
      console.log(context.user._id);
      if (context.user) {
        const userData = await User.findOne({ _id: context.user._id })
          .select("-__v -password")
          .populate("friends");

        return userData;
      }

      throw new AuthenticationError("Not logged in");
    },

    // search all users
    search: async (parent, { username }, context) => {
      console.log(username);
      const keyword = username
        ? {
            $or: [
              { name: { $regex: username, $options: "i" } },
              { email: { $regex: username, $options: "i" } },
            ],
          }
        : {};
      console.log(keyword);
      return await User.find(keyword) //.find({ _id: { $ne: context.user._id } })
        .select("-__v -password")
        .populate("messages")
        .populate("friends");
    },

    // get all users
    users: async () => {
      return await User.find()
        .select("-__v -password")
        .populate("messages")
        .populate("friends");
    },

    // get one users
    user: async (parent, { username }) => {
      return await User.findOne({ username })
        .select("-__v -password")
        .populate("messages")
        .populate("friends");
    },

    // get all users
    chats: async () => {
      return await Chat.find()
        .select("-__v -password")
        .populate("chatMessages")
        .populate("users");
    },

    // get chat
    chat: async (parent, { _id }) => {
      return await Chat.findOne({ _id })
        .select("-__v")
        .populate({ path: "chatMessages", populate: { path: "sender" } })
        .populate("users");
    },

    // get message with param option username
    messages: async (parent, { username }) => {
      return await Message.find(username)
        .sort({ createdAt: -1 })
        .populate("sender")
        .populate("chat");
    },

    // get a single message
    message: async (parent, { _id }) => {
      return await Message.findOne({ _id }).populate("sender").populate("chat");
    },
  },

  Mutation: {
    addUser: async (parent, args) => {
      const user = await User.create(args);
      const token = signToken(user);

      return { token, user };
    },
    login: async (parent, { email, password }) => {
      const user = await User.findOne({ email });

      if (!user) {
        throw new AuthenticationError("Incorrect credentials");
      }

      const correctPw = await user.isCorrectPassword(password);

      if (!correctPw) {
        throw new AuthenticationError("Incorrect credentials");
      }

      const token = signToken(user);
      return { token, user };
    },
    addMessage: async (parent, { messageText, chatId }, context) => {
      if (context.user) {
        const message = await Message.create({
          chat: chatId,
          sender: context.user._id,
          messageText: messageText,
        });

        const messageAddedToChat = await Chat.findByIdAndUpdate(
          { _id: chatId },
          { $push: { chatMessages: message._id } },
          { new: true }
        );

        await User.findByIdAndUpdate(
          { _id: context.user._id },
          { $push: { messages: message._id } },
          { new: true }
        );
          console.log("messageAddedToChat:", messageAddedToChat);
        return message;
      }

      throw new AuthenticationError("You need to be logged in!");
    },
    addFriend: async (parent, { friendId }, context) => {
      if (context.user) {
        console.log("my id: ", context.user._id);
        console.log("friend id: ", friendId);
        const updatedUser = await User.findOneAndUpdate(
          { _id: context.user._id },
          { $addToSet: { friends: friendId } },
          { new: true }
        ).populate("friends");

        return updatedUser;
      }

      throw new AuthenticationError("You need to be logged in!");
    },
    addChat: async (parent, { chatName, userId }, context) => {
      if (context.user) {
        const chatExists = await Chat.find({
          $and: [
            { users: { $elemMatch: { $eq: context.user._id } } },
            { users: { $elemMatch: { $eq: userId } } },
          ],
        })
          .select("-__v")
          .populate("users")

        console.log("chatExists: ", chatExists);

        if (chatExists.length > 0) {
          return chatExists[0];
        } else {
          let chatData = {
            chatName: chatName,
            users: [userId, context.user._id],
          };

          const chat = await Chat.create(chatData);

          return chat;
        }
      }

      throw new AuthenticationError("You need to be logged in!");
    },
  },
};

module.exports = resolvers;
