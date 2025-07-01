#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Blog Data Generator
 * 
 * Scans the blog/posts directory for markdown files,
 * extracts frontmatter metadata, and generates blog-data.json
 * 
 * Usage: node generate-blog-data.js
 */

class BlogDataGenerator {
  constructor() {
    this.postsDir = path.join(__dirname, 'posts');
    this.outputFile = path.join(__dirname, 'blog-data.json');
    this.blogData = [];
  }

  /**
   * Main execution function
   */
  async generate() {
    console.log('🚀 Generating blog data...');
    
    try {
      // Check if posts directory exists
      if (!fs.existsSync(this.postsDir)) {
        console.error('❌ Posts directory not found:', this.postsDir);
        console.log('💡 Creating posts directory...');
        fs.mkdirSync(this.postsDir, { recursive: true });
        console.log('✅ Posts directory created');
        return;
      }

      // Scan for markdown files
      const markdownFiles = this.getMarkdownFiles();
      
      if (markdownFiles.length === 0) {
        console.log('⚠️  No markdown files found in posts directory');
        this.writeBlogData([]);
        return;
      }

      console.log(`📄 Found ${markdownFiles.length} markdown file(s)`);

      // Process each markdown file
      for (const file of markdownFiles) {
        await this.processMarkdownFile(file);
      }

      // Sort posts by date (newest first)
      this.blogData.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Write the JSON file
      this.writeBlogData(this.blogData);
      
      console.log('✅ Blog data generated successfully!');
      console.log(`📊 Processed ${this.blogData.length} blog post(s)`);
      
      // Display summary
      this.displaySummary();

    } catch (error) {
      console.error('❌ Error generating blog data:', error.message);
      process.exit(1);
    }
  }

  /**
   * Get all markdown files from posts directory
   */
  getMarkdownFiles() {
    return fs.readdirSync(this.postsDir)
      .filter(file => file.endsWith('.md'))
      .map(file => path.join(this.postsDir, file));
  }

  /**
   * Process a single markdown file and extract metadata
   */
  async processMarkdownFile(filePath) {
    try {
      const filename = path.basename(filePath, '.md');
      const content = fs.readFileSync(filePath, 'utf8');
      
      console.log(`📝 Processing: ${filename}.md`);

      // Parse frontmatter
      const { frontmatter, markdownContent } = this.parseFrontmatter(content);
      
      // Validate required fields
      const validatedData = this.validateAndEnrichData(frontmatter, filename, markdownContent);
      
      if (validatedData) {
        this.blogData.push(validatedData);
        console.log(`   ✅ Added: ${validatedData.title}`);
      }

    } catch (error) {
      console.error(`   ❌ Error processing ${filePath}:`, error.message);
    }
  }

  /**
   * Parse frontmatter from markdown content
   */
  parseFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      throw new Error('No frontmatter found. Please add YAML frontmatter to your markdown file.');
    }

    try {
      const frontmatter = yaml.load(match[1]);
      const markdownContent = match[2];
      return { frontmatter, markdownContent };
    } catch (error) {
      throw new Error(`Invalid YAML frontmatter: ${error.message}`);
    }
  }

  /**
   * Validate required fields and enrich data
   */
  validateAndEnrichData(frontmatter, filename, markdownContent) {
    // Required fields
    const required = ['title', 'excerpt', 'date'];
    const missing = required.filter(field => !frontmatter[field]);
    
    if (missing.length > 0) {
      console.error(`   ⚠️  Missing required fields: ${missing.join(', ')}`);
      return null;
    }

    // Auto-generate slug if not provided
    if (!frontmatter.slug) {
      frontmatter.slug = filename;
      console.log(`   🔧 Auto-generated slug: ${frontmatter.slug}`);
    }

    // Auto-calculate read time if not provided
    if (!frontmatter.readTime) {
      frontmatter.readTime = this.calculateReadTime(markdownContent);
      console.log(`   📖 Auto-calculated read time: ${frontmatter.readTime} min`);
    }

    // Validate date format
    if (!this.isValidDate(frontmatter.date)) {
      console.error(`   ⚠️  Invalid date format: ${frontmatter.date}. Use YYYY-MM-DD format.`);
      return null;
    }

    // Clean and validate data
    return {
      title: String(frontmatter.title).trim(),
      excerpt: String(frontmatter.excerpt).trim(),
      date: frontmatter.date,
      readTime: Number(frontmatter.readTime),
      image: frontmatter.image || null,
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      slug: String(frontmatter.slug).trim(),
      // Optional fields
      author: frontmatter.author || null,
      category: frontmatter.category || null,
      featured: Boolean(frontmatter.featured),
      published: frontmatter.published !== false // Default to true unless explicitly false
    };
  }

  /**
   * Calculate estimated read time based on word count
   */
  calculateReadTime(content) {
    const wordsPerMinute = 200; // Average reading speed
    const words = content.trim().split(/\s+/).length;
    const readTime = Math.ceil(words / wordsPerMinute);
    return Math.max(1, readTime); // Minimum 1 minute
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = new Date(dateString + 'T00:00:00');
    return date.toISOString().startsWith(dateString);
  }

  /**
   * Write blog data to JSON file
   */
  writeBlogData(data) {
    const jsonContent = JSON.stringify(data, null, 2);
    fs.writeFileSync(this.outputFile, jsonContent, 'utf8');
    console.log(`💾 Blog data written to: ${path.relative(process.cwd(), this.outputFile)}`);
  }

  /**
   * Display summary of generated data
   */
  displaySummary() {
    if (this.blogData.length === 0) {
      console.log('📋 No blog posts to display');
      return;
    }

    console.log('\n📋 Blog Posts Summary:');
    console.log('═'.repeat(60));
    
    this.blogData.forEach((post, index) => {
      console.log(`${index + 1}. ${post.title}`);
      console.log(`   📅 ${post.date} | ⏱ ${post.readTime} min | 🏷️ ${post.tags.join(', ')}`);
      console.log(`   🔗 Slug: ${post.slug}`);
      if (index < this.blogData.length - 1) console.log('');
    });
    
    console.log('═'.repeat(60));
    console.log(`\n🎉 Total: ${this.blogData.length} published blog post(s)`);
    
    // Show tags summary
    const allTags = [...new Set(this.blogData.flatMap(post => post.tags))];
    if (allTags.length > 0) {
      console.log(`🏷️  Tags used: ${allTags.join(', ')}`);
    }
  }
}

/**
 * CLI interface
 */
function showHelp() {
  console.log(`
📝 Blog Data Generator

Usage: node generate-blog-data.js [options]

Options:
  --help, -h     Show this help message
  --watch, -w    Watch for changes and auto-regenerate (future feature)
  --verbose, -v  Show verbose output

Example markdown frontmatter:
---
title: "Your Blog Post Title"
excerpt: "A brief description of your post"
date: "2025-03-15"
readTime: 5
image: "https://example.com/image.jpg"
tags: ["AI", "Technology"]
slug: "your-blog-post-slug"
---

Required fields: title, excerpt, date
Optional fields: readTime (auto-calculated), image, tags, slug (auto-generated)
  `);
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  const generator = new BlogDataGenerator();
  generator.generate().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = BlogDataGenerator;