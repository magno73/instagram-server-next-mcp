import path from 'path';
import fs from 'fs/promises';
import { FileSystemError } from '../../../core/utils/errors.js';
import { MediaDownloader } from './media.js';
import { SEOGenerator } from './seo.js';
export class PostProcessor {
    constructor() {
        this.seoGenerator = new SEOGenerator();
        this.mediaDownloader = new MediaDownloader();
    }
    async processPost(postData, saveDir, username) {
        const postId = MediaDownloader.getPostIdFromUrl(postData.postUrl);
        const dateStr = new Date(postData.timestamp).toISOString().split('T')[0];
        const postDir = path.join(saveDir, username, dateStr, MediaDownloader.sanitizeFilename(postId));
        const mediaExt = postData.type === 'video' ? '.mp4' : '.jpg';
        const mediaPath = path.join(postDir, `media${mediaExt}`);
        await this.mediaDownloader.downloadMedia(postData.type === 'video' && postData.videoUrl ? postData.videoUrl : postData.mediaUrl, mediaPath);
        let posterPath;
        if (postData.type === 'video' && postData.posterUrl) {
            posterPath = path.join(postDir, 'poster.jpg');
            await this.mediaDownloader.downloadPoster(postData.posterUrl, posterPath);
        }
        const hashtags = this.seoGenerator.extractHashtags(postData.caption);
        return {
            id: postId,
            type: postData.type,
            mediaUrl: postData.mediaUrl,
            localMediaPath: mediaPath,
            alt: postData.alt,
            caption: postData.caption,
            seoDescription: this.seoGenerator.generateDescription({
                type: postData.type,
                mediaUrl: postData.mediaUrl,
                alt: postData.alt,
                caption: postData.caption,
                hashtags,
            }),
            timestamp: postData.timestamp,
            postUrl: postData.postUrl,
            hashtags,
            ...(postData.type === 'video' && {
                videoUrl: postData.videoUrl,
                posterUrl: postData.posterUrl
            })
        };
    }
}
export class PostSaver {
    constructor(postsLogFile) {
        this.postsCache = null;
        this.postsLogFile = postsLogFile;
    }
    async savePost(post, saveDir) {
        try {
            const postDir = path.dirname(post.localMediaPath);
            await fs.writeFile(path.join(postDir, 'metadata.json'), JSON.stringify({
                ...post,
                fetchDate: new Date().toISOString()
            }));
        }
        catch (error) {
            throw new FileSystemError(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async loadFetchedPosts() {
        if (this.postsCache)
            return this.postsCache;
        try {
            const data = await fs.readFile(this.postsLogFile, 'utf-8');
            const log = JSON.parse(data);
            this.postsCache = new Map(Object.entries(log.posts || {}));
            return this.postsCache;
        }
        catch {
            this.postsCache = new Map();
            return this.postsCache;
        }
    }
    async saveFetchedPosts(posts) {
        try {
            await fs.writeFile(this.postsLogFile, JSON.stringify({
                lastFetch: new Date().toISOString(),
                posts: Object.fromEntries(posts)
            }));
            this.postsCache = posts;
        }
        catch (error) {
            throw new FileSystemError(`Log save failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
//# sourceMappingURL=post.js.map