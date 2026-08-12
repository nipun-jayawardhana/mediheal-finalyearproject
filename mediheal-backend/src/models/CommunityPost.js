const mongoose = require('mongoose');

const communityPostSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author ID reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true,
      minlength: [5, 'Content must be at least 5 characters long'],
      maxlength: [2000, 'Content cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      enum: {
        values: [
          'general',
          'nutrition',
          'exercise',
          'medication',
          'elderly-care',
          'wellbeing',
          'other',
        ],
        message:
          '{VALUE} is not a valid category. Allowed: general, nutrition, exercise, medication, elderly-care, wellbeing, other',
      },
      default: 'general',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for query performance
communityPostSchema.index({ createdAt: -1 });
communityPostSchema.index({ category: 1, createdAt: -1 });
communityPostSchema.index({ authorId: 1 });

const CommunityPost = mongoose.model('CommunityPost', communityPostSchema);

module.exports = CommunityPost;
