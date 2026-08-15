import { apiClient } from '../api/apiClient';
import {
  CommunityFeedResponse,
  CommunityPostDetailsResponse,
  CommunityPostResponse,
  CommunityCommentResponse,
  GenericCommunityResponse,
  CreatePostRequest,
  UpdatePostRequest,
  CreateCommentRequest,
} from '../types/community';

/**
 * Get active community posts feed
 * GET /api/community/posts
 */
export const getCommunityPosts = async (params?: {
  category?: string;
  page?: number;
  limit?: number;
}): Promise<CommunityFeedResponse> => {
  const response = await apiClient.get<CommunityFeedResponse>(
    '/community/posts',
    { params }
  );
  return response.data;
};

/**
 * Get single community post and its active comments
 * GET /api/community/posts/:postId
 */
export const getCommunityPostById = async (
  postId: string
): Promise<CommunityPostDetailsResponse> => {
  const response = await apiClient.get<CommunityPostDetailsResponse>(
    `/community/posts/${postId}`
  );
  return response.data;
};

/**
 * Create a new community post
 * POST /api/community/posts
 */
export const createCommunityPost = async (
  payload: CreatePostRequest
): Promise<CommunityPostResponse> => {
  const response = await apiClient.post<CommunityPostResponse>(
    '/community/posts',
    payload
  );
  return response.data;
};

/**
 * Update own community post
 * PUT /api/community/posts/:postId
 */
export const updateCommunityPost = async (
  postId: string,
  payload: UpdatePostRequest
): Promise<CommunityPostResponse> => {
  const response = await apiClient.put<CommunityPostResponse>(
    `/community/posts/${postId}`,
    payload
  );
  return response.data;
};

/**
 * Soft delete own community post
 * DELETE /api/community/posts/:postId
 */
export const removeCommunityPost = async (
  postId: string
): Promise<GenericCommunityResponse> => {
  const response = await apiClient.delete<GenericCommunityResponse>(
    `/community/posts/${postId}`
  );
  return response.data;
};

/**
 * Add comment to an active community post
 * POST /api/community/posts/:postId/comments
 */
export const addCommunityComment = async (
  postId: string,
  payload: CreateCommentRequest
): Promise<CommunityCommentResponse> => {
  const response = await apiClient.post<CommunityCommentResponse>(
    `/community/posts/${postId}/comments`,
    payload
  );
  return response.data;
};

/**
 * Soft delete own comment
 * DELETE /api/community/comments/:commentId
 */
export const removeCommunityComment = async (
  commentId: string
): Promise<GenericCommunityResponse> => {
  const response = await apiClient.delete<GenericCommunityResponse>(
    `/community/comments/${commentId}`
  );
  return response.data;
};
