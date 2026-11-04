import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

function MainPage() {
  return (
    <div className="min-h-screen bg-[#1C1C1C] text-white p-8 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-2">ИИ-тренажёр собеседований</h1>
      <p className="text-gray-400 mb-8">Главная страница (Dev-меню для навигации)</p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
        <Link to="/login">
          <Button className="w-full bg-[#D4FF5E] text-black hover:bg-[#b8e04a]">
            Экран входа (Login)
          </Button>
        </Link>

        <Link to="/register">
          <Button className="w-full bg-[#D4FF5E] text-black hover:bg-[#b8e04a]">
            Экран регистрации (Register)
          </Button>
        </Link>

        <Link to="/interview/1">
          <Button variant="outline" className="w-full border-gray-600 text-white hover:bg-white/10">
            Прохождение интервью (ID: 1)
          </Button>
        </Link>

        <Link to="/interview/1/results">
          <Button variant="outline" className="w-full border-gray-600 text-white hover:bg-white/10">
            Результаты (ID: 1)
          </Button>
        </Link>

        <Link to="/history">
          <Button variant="outline" className="w-full border-gray-600 text-white hover:bg-white/10">
            История интервью
          </Button>
        </Link>

        <Link to="/random-page">
          <Button variant="outline" className="w-full border-gray-600 text-red-400 hover:bg-white/10">
            Проверка 404
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default MainPage