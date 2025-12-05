import latteImg from '@assets/generated_images/latte_art_in_cozy_cafe.png';
import puppyImg from '@assets/generated_images/golden_retriever_puppy.png';
import santoriniImg from '@assets/generated_images/travel_influencer_santorini.png';
import avocadoImg from '@assets/generated_images/avocado_toast_brunch.png';

export interface Video {
  id: string;
  url: string;
  username: string;
  userAvatar: string;
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  song: string;
  description?: string; // For accessibility
}

export const INITIAL_VIDEOS: Video[] = [
  {
    id: '1',
    url: latteImg,
    username: 'coffee_lover_99',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=coffee',
    caption: 'Morning vibes ☕️ #coffee #art',
    likes: 1240,
    comments: 45,
    shares: 12,
    song: 'Morning Coffee - LoFi Beats',
    description: 'Latte art in a cozy cafe'
  },
  {
    id: '2',
    url: puppyImg,
    username: 'golden_boy_max',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=max',
    caption: 'Playtime in the park! 🐶 #goldenretriever #puppy',
    likes: 8500,
    comments: 342,
    shares: 1500,
    song: 'Happy Dog - Pet Sounds',
    description: 'Golden retriever puppy playing'
  },
  {
    id: '3',
    url: santoriniImg,
    username: 'travel_with_sarah',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
    caption: 'Take me back to Greece 🇬🇷 #travel #santorini',
    likes: 15200,
    comments: 890,
    shares: 4300,
    song: 'Summer Vibes - Beach House',
    description: 'Scenic view in Santorini'
  },
  {
    id: '4',
    url: avocadoImg,
    username: 'brunch_nyc',
    userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=brunch',
    caption: 'Best avocado toast in the city 🥑 #foodie #nyc',
    likes: 3400,
    comments: 120,
    shares: 56,
    song: 'Yummy - Food Tastes Good',
    description: 'Delicious avocado toast'
  }
];
