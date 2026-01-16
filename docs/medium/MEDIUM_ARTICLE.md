# I Built My Own RSS Reader Because I'm Afraid Feedly Will Die Someday

*A love letter to RSS, and a backup plan for when the inevitable happens*

---

## The Death of Read-It-Later

In 2025, Pocket officially shut down its services. For many of us, it felt like watching an old friend fade away. Pocket had been around since 2007 (originally as "Read It Later"), survived the transition to mobile, got acquired by Mozilla, and ultimately couldn't find a sustainable path forward.

I didn't use Pocket much, but the news hit me harder than expected. It wasn't about Pocket itself—it was about what it represented: **another piece of the open web dying**.

## My RSS Journey: 15 Years and Counting

I've been using RSS readers for over 15 years. It started with Google Reader back in 2008. Every morning, I'd open it up with my coffee, catching up on tech blogs, news sites, and niche publications that mainstream media would never cover.

Then came July 1, 2013—the day Google killed Reader. Like millions of others, I migrated to Feedly. It was a solid replacement, and I've been using it ever since.

But here's the thing: **I know RSS is dying**.

The younger generation doesn't know what RSS is. Most websites have removed their RSS feed links from their homepages (though the feeds still exist if you know where to look). Social media algorithms have replaced the chronological, curated experience that RSS provided.

![FeedOwn Web App - Article List](web_screenshots/web_app_2.png)
*FeedOwn showing my daily news feed*

## The Fear That Started This Project

After Pocket's shutdown, I started thinking: **What if Feedly shuts down?** What if Inoreader does? These services aren't charities—they're businesses that need to turn a profit. And the RSS reader market isn't exactly booming.

I realized I was entirely dependent on services I had no control over. All my carefully curated feed subscriptions, years of reading habits, saved articles—all of it could disappear with a single shutdown announcement.

That fear became the starting point for FeedOwn.

## Introducing FeedOwn: Own Your Feeds

FeedOwn is a self-hosted RSS reader that you can deploy on your own infrastructure. No subscription fees. No company that might go bankrupt. No algorithm deciding what you should read. Just you and your feeds.

![FeedOwn Login Screen](web_screenshots/web_app_1.png)
*Clean, simple login screen*

### Key Features

**Cross-Platform Experience**

FeedOwn works on the web and has native mobile apps for both iOS and Android. Your reading progress syncs across all devices.

![FeedOwn Mobile App](mobile_screenshots/mobile_ss_articles1.PNG)
*The mobile app feels native and responsive*

**Reader Mode**

Like Pocket or Safari's Reader Mode, FeedOwn can extract the main content from articles, giving you a clean reading experience without ads, popups, or distracting sidebars.

![Reader Mode](mobile_screenshots/mobile_ss_reader1.PNG)
*Reader mode extracts just the article content*

**Dark Mode**

Because of course it has dark mode. It's 2026.

![Dark Mode](mobile_screenshots/mobile_ss_articles2.PNG)
*Easy on the eyes for late-night reading*

**Feed Management**

Add feeds by URL, browse recommended feeds to get started, and organize your subscriptions.

![Feed Management](web_screenshots/web_app_4.png)
*Managing your feed subscriptions*

**Favorites**

Save articles you want to revisit later. Unlike Pocket, these are stored in your own database—they won't disappear when a company decides to pivot.

![Favorites](web_screenshots/web_app_5.png)
*Your saved articles, forever yours*

## The Tech Stack

FeedOwn is built with modern, serverless technologies that keep hosting costs minimal:

- **Frontend**: React (Web) + React Native/Expo (Mobile)
- **Backend**: Cloudflare Pages Functions (serverless, generous free tier)
- **Database**: Supabase PostgreSQL (also has a generous free tier)
- **RSS Proxy**: Cloudflare Workers with KV cache

The entire stack can run on free tiers for personal use. You're looking at $0/month to host your own RSS reader.

## Self-Hosting: It's Easier Than You Think

I've written comprehensive documentation for self-hosting FeedOwn. If you can follow a tutorial and copy-paste some configuration values, you can deploy your own instance.

The setup involves:
1. Creating a Supabase project (5 minutes)
2. Creating a Cloudflare Pages project (5 minutes)
3. Deploying the code

No servers to manage. No Docker containers to babysit. No monthly VPS bills.

## Try It Out

**Don't want to self-host?** You can use the public instance:
- Web: https://feedown.pages.dev
- iOS: [App Store](https://apps.apple.com/us/app/feedown/id6757896656)
- Android: [Google Play](https://play.google.com/store/apps/details?id=net.votepurchase.feedown)

**Want to self-host?** Check out the documentation:
- GitHub: https://github.com/kiyohken2000/feedown
- Setup Guide: https://feedown.pages.dev/docs/setup

## The Future of RSS (Or Lack Thereof)

I'm under no illusion that RSS will make a comeback. The format served its purpose during Web 2.0, and the world has moved on to algorithmic feeds and social media.

But for those of us who still appreciate the simplicity of subscribing to content and reading it on our own terms, RSS remains the best solution. No algorithm. No engagement optimization. No "you might also like" interruptions.

FeedOwn isn't trying to save RSS. It's trying to ensure that those of us who still use it aren't left stranded when the commercial services eventually shut down.

Because they will. Someday. And when that day comes, I'll still have my feeds.

---

*FeedOwn is open source and free to use. If you're a fellow RSS holdout, I'd love to hear your story. Find me on GitHub or try the app yourself.*

**Links:**
- Live Demo: https://feedown.pages.dev
- GitHub: https://github.com/kiyohken2000/feedown
- App Store: https://apps.apple.com/us/app/feedown/id6757896656
- Google Play: https://play.google.com/store/apps/details?id=net.votepurchase.feedown
