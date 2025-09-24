# Script to generate data/news.json locally before deployment (run this locally with your environment)
import json
import requests

def fetch_all_news(base_url = "https://backend-kemenag-batubara.vercel.app/api/search?keyword=batu+bara"):
    all_posts = []
    pagination = [base_url]
    while pagination:
        url = pagination.pop(0)  # Use pop(0) to process in order
        try:
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            all_posts.extend(data['posts'])
            pagination.extend(data['pagination'])  # Add new pagination links
            print(f"Fetched {len(data['posts'])} posts from {data['scraped_url']}")
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            break
    
    # Save to data/news.json
    with open('data/news.json', 'w', encoding='utf-8') as f:
        json.dump({"posts": all_posts, "pagination": [], "total_posts": len(all_posts), "scraped_url": base_url}, f, ensure_ascii=False, indent=4)
    print(f"Saved {len(all_posts)} posts to data/news.json")

# Run locally
fetch_all_news()