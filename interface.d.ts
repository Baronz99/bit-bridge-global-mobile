interface Movie {
  id: number
  title: string
  adult: boolean
  backdropt_path: string
  genre_ids: number[]
  original_language: string
  origibal_title: string
  overview: string
  popularity: number
  poster_path: string
  release_date: string
  video: boolean
  vote_average: number
  vote_count: number
}
interface TrendingCardProps {
  movie_id: number
  title: string
  poster_url: string
}
