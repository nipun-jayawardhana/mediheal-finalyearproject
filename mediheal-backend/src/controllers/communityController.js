const mongoose = require('mongoose');
const CommunityPost = require('../models/CommunityPost');
const CommunityComment = require('../models/CommunityComment');

const MEDICAL_DISCLAIMER =
  'Community content is shared by users and should not be considered professional medical advice.';

const ALLOWED_CATEGORIES = [
  'general',
  'nutrition',
  'exercise',
  'medication',
  'elderly-care',
  'wellbeing',
  'other',
];

/**
 * @desc    Create a new community post (Patient & Caregiver only)
 * @route   POST /api/community/posts
 * @access  Private (Patient & Caregiver)
 */
const createPost = async (req, res, next) => {
  try {
    const authorId = req.user._id;
    const { title, content, category } = req.body;

    // 1. Title validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Post title is required',
      });
    }

    const cleanTitle = title.trim();
    if (cleanTitle.length < 3 || cleanTitle.length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Post title must be between 3 and 120 characters',
      });
    }

    // 2. Content validation
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Post content is required',
      });
    }

    const cleanContent = content.trim();
    if (cleanContent.length < 5 || cleanContent.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Post content must be between 5 and 2000 characters',
      });
    }

    // 3. Category validation
    let postCategory = 'general';
    if (category) {
      const cleanCategory = String(category).toLowerCase().trim();
      if (!ALLOWED_CATEGORIES.includes(cleanCategory)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Allowed options: ${ALLOWED_CATEGORIES.join(', ')}`,
        });
      }
      postCategory = cleanCategory;
    }

    // 4. Create CommunityPost record
    let post = await CommunityPost.create({
      authorId,
      title: cleanTitle,
      content: cleanContent,
      category: postCategory,
      isActive: true,
    });

    post = await post.populate('authorId', 'fullName role');

    return res.status(201).json({
      success: true,
      message: 'Community post created successfully',
      data: post,
      disclaimer: MEDICAL_DISCLAIMER,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get active community posts feed with category filter and pagination
 * @route   GET /api/community/posts
 * @access  Private (Patient & Caregiver)
 */
const getPosts = async (req, res, next) => {
  try {
    const filter = { isActive: true };

    // Category filter
    if (req.query.category) {
      const categoryStr = req.query.category.toLowerCase().trim();
      if (!ALLOWED_CATEGORIES.includes(categoryStr)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category filter. Allowed options: ${ALLOWED_CATEGORIES.join(', ')}`,
        });
      }
      filter.category = categoryStr;
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const total = await CommunityPost.countDocuments(filter);
    const pages = Math.ceil(total / limit) || 1;

    const posts = await CommunityPost.find(filter)
      .populate('authorId', 'fullName role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: posts.length,
      pagination: {
        total,
        page,
        pages,
        limit,
      },
      data: posts,
      disclaimer: MEDICAL_DISCLAIMER,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single community post and its active comments
 * @route   GET /api/community/posts/:postId
 * @access  Private (Patient & Caregiver)
 */
const getPostById = async (req, res, next) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID format',
      });
    }

    const post = await CommunityPost.findOne({ _id: postId, isActive: true }).populate(
      'authorId',
      'fullName role'
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Community post not found or unavailable',
      });
    }

    const comments = await CommunityComment.find({ postId, isActive: true })
      .populate('authorId', 'fullName role')
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      data: {
        post,
        comments,
        disclaimer: MEDICAL_DISCLAIMER,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update own community post
 * @route   PUT /api/community/posts/:postId
 * @access  Private (Patient & Caregiver)
 */
const updatePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { title, content, category } = req.body;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID format',
      });
    }

    const post = await CommunityPost.findById(postId);

    if (!post || !post.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Community post not found or unavailable',
      });
    }

    // Ownership check
    if (post.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this community post',
      });
    }

    // Update title if provided
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Post title cannot be blank',
        });
      }
      const cleanTitle = title.trim();
      if (cleanTitle.length < 3 || cleanTitle.length > 120) {
        return res.status(400).json({
          success: false,
          message: 'Post title must be between 3 and 120 characters',
        });
      }
      post.title = cleanTitle;
    }

    // Update content if provided
    if (content !== undefined) {
      if (typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Post content cannot be blank',
        });
      }
      const cleanContent = content.trim();
      if (cleanContent.length < 5 || cleanContent.length > 2000) {
        return res.status(400).json({
          success: false,
          message: 'Post content must be between 5 and 2000 characters',
        });
      }
      post.content = cleanContent;
    }

    // Update category if provided
    if (category !== undefined) {
      const cleanCategory = String(category).toLowerCase().trim();
      if (!ALLOWED_CATEGORIES.includes(cleanCategory)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Allowed options: ${ALLOWED_CATEGORIES.join(', ')}`,
        });
      }
      post.category = cleanCategory;
    }

    await post.save();
    await post.populate('authorId', 'fullName role');

    return res.status(200).json({
      success: true,
      message: 'Community post updated successfully',
      data: post,
      disclaimer: MEDICAL_DISCLAIMER,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Soft delete own community post
 * @route   DELETE /api/community/posts/:postId
 * @access  Private (Patient & Caregiver)
 */
const removePost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID format',
      });
    }

    const post = await CommunityPost.findById(postId);

    if (!post || !post.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Community post not found or unavailable',
      });
    }

    // Ownership check
    if (post.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove this community post',
      });
    }

    post.isActive = false;
    await post.save();

    return res.status(200).json({
      success: true,
      message: 'Community post removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add comment to an active community post
 * @route   POST /api/community/posts/:postId/comments
 * @access  Private (Patient & Caregiver)
 */
const addComment = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID format',
      });
    }

    const post = await CommunityPost.findById(postId);

    if (!post || !post.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot comment on an inactive or non-existent post',
      });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required',
      });
    }

    const cleanContent = content.trim();
    if (cleanContent.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Comment content cannot exceed 1000 characters',
      });
    }

    let comment = await CommunityComment.create({
      postId,
      authorId: req.user._id,
      content: cleanContent,
      isActive: true,
    });

    comment = await comment.populate('authorId', 'fullName role');

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: comment,
      disclaimer: MEDICAL_DISCLAIMER,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Soft delete own comment
 * @route   DELETE /api/community/comments/:commentId
 * @access  Private (Patient & Caregiver)
 */
const removeComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid comment ID format',
      });
    }

    const comment = await CommunityComment.findById(commentId);

    if (!comment || !comment.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Community comment not found or unavailable',
      });
    }

    // Ownership check
    if (comment.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove this comment',
      });
    }

    comment.isActive = false;
    await comment.save();

    return res.status(200).json({
      success: true,
      message: 'Comment removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  removePost,
  addComment,
  removeComment,
};
