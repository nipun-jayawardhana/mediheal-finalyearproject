/**
 * Community Health Data Models & Service Types
 */

export type CommunityCategory =
  | 'general'
  | 'nutrition'
  | 'exercise'
  | 'medication'
  | 'elderly-care'
  | 'wellbeing'
  | 'other';

export interface CommunityAuthor {
  _id: string;
  fullName: string;
  role: string;
}

export interface CommunityPost {
  _id: string;
  authorId: CommunityAuthor | string;
  title: string;
  content: string;
  category: CommunityCategory;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommunityComment {
  _id: string;
  postId: string;
  authorId: CommunityAuthor | string;
  content: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePostRequest {
  title: string;
  content: string;
  category?: CommunityCategory;
}

export interface UpdatePostRequest {
  title?: string;
  content?: string;
  category?: CommunityCategory;
}

export interface CreateCommentRequest {
  content: string;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface CommunityFeedResponse {
  success: boolean;
  count: number;
  pagination: PaginationMetadata;
  data: CommunityPost[];
  disclaimer?: string;
  message?: string;
}

export interface CommunityPostDetailsData {
  post: CommunityPost;
  comments: CommunityComment[];
  disclaimer: string;
}

export interface CommunityPostDetailsResponse {
  success: boolean;
  data: CommunityPostDetailsData;
  message?: string;
}

export interface CommunityPostResponse {
  success: boolean;
  data: CommunityPost;
  disclaimer?: string;
  message?: string;
}

export interface CommunityCommentResponse {
  success: boolean;
  data: CommunityComment;
  disclaimer?: string;
  message?: string;
}

export interface GenericCommunityResponse {
  success: boolean;
  message?: string;
}
