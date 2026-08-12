const mongoose = require('mongoose');

const communityCommentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityPost',
      required: [true, 'Post ID reference is required'],
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author ID reference is required'],
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      minlength: [1, 'Comment content must be at least 1 character long'],
      maxlength: [1000, 'Comment content cannot exceed 1000 characters'],
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
communityCommentSchema.index({ postId: 1, createdAt: 1 });
communityCommentSchema.index({ authorId: 1 });

const CommunityComment = mongoose.model('CommunityComment', communityCommentSchema);

module.exports = CommunityComment;
