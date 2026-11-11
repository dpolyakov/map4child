import { venueInputSchema, type VenueInput } from '../shared/marketplace-model';

// Fictional venues. Photos illustrate the activity; they do not depict these venues.
const samples = [
  ['Палитра', 'Рисование', 'Творчество и искусство', 'Москва, Малая Бронная улица, 12', 55.7621, 37.5961, 0, '1517697471339-4aa32003c11a', 'Debby Hudson', 'https://unsplash.com/photos/mason-jar-of-paintbrush-lot-MzSqFPLo8CE', 'Цвет и форма', 'Пробуем акварель, смешиваем краски и создаём свою иллюстрацию. Каждый уносит домой готовую работу.', 'Анна Светлова', 'Художник и педагог. Помогает замечать детали и смело экспериментировать.'],
  ['Ритм', 'Танцы', 'Творчество и искусство', 'Москва, Зоологическая улица, 4', 55.7659, 37.5841, 600, '1779617926288-fde3f7fb7b5d', 'Andrey K', 'https://unsplash.com/photos/ballet-studio-with-pink-curtains-and-a-wooden-barre-zG3dYdeM3dk', 'Современный танец', 'Разминка, чувство ритма и небольшая танцевальная связка. Начинаем с простых движений.', 'Мария Ритмова', 'Хореограф. Ведёт группы начинающих и помогает двигаться уверенно.'],
  ['Мастерская идей', 'Робототехника', 'ИТ и инженерия', 'Москва, Большая Грузинская улица, 15', 55.7678, 37.5783, 900, '1776106505438-3a509aabeaad', 'Maciej Karoń', 'https://unsplash.com/photos/building-instructions-and-scattered-lego-bricks-on-wooden-table-NUG2vYO6V6s', 'Робот своими руками', 'Собираем механизм, подключаем датчик и пишем первую программу. Работаем в парах.', 'Илья Механиков', 'Инженер и наставник. Объясняет механику на понятных примерах.'],
  ['Нота', 'Музыка', 'Творчество и искусство', 'Москва, Большой Козихинский переулок, 8', 55.7622, 37.5983, 800, '1744176252098-570bbb9b1bb0', 'Ria Nurul Kamariah', 'https://unsplash.com/photos/a-beautiful-white-grand-piano-sits-in-a-room-gcyNGB2w5YM', 'Знакомство с фортепиано', 'Исследуем клавиши, слушаем мелодии и играем короткую пьесу без подготовки.', 'Елена Ладова', 'Пианистка и преподаватель. Начинает обучение через слух и игру.'],
  ['Белый конь', 'Шахматы', 'Наука', 'Москва, Красная Пресня, 8', 55.7617, 37.5726, 500, '1528819622765-d6bcf132f793', 'Felix Mittermeier', 'https://unsplash.com/photos/chess-pieces-on-board-nAjil1z3eLk', 'Первый ход', 'Знакомимся с фигурами, решаем игровые задачи и играем первую короткую партию.', 'Павел Фигуров', 'Шахматный тренер. Учит замечать варианты и объяснять решения.'],
  ['Движение', 'Спорт', 'Спорт', 'Москва, улица Заморёнова, 12', 55.7603, 37.5678, 700, '1768554630751-6448593749eb', 'Mattia Graziani', 'https://unsplash.com/photos/empty-indoor-basketball-court-with-wooden-floor-tJ6GF320Y64', 'Игровая физкультура', 'Развиваем координацию и ловкость через эстафеты и игры с мячом.', 'Алексей Игров', 'Тренер по общей физической подготовке. Подбирает нагрузку по возрасту.'],
  ['Лаборатория «Почему»', 'Наука', 'Наука', 'Москва, Садовая-Кудринская улица, 9', 55.7652, 37.5892, 1000, '1518152006812-edab29b069ac', 'Ousa Chea', 'https://unsplash.com/photos/white-microscope-on-top-of-black-table-gKUC4TMhOiY', 'Мир под микроскопом', 'Рассматриваем образцы, строим гипотезы и записываем наблюдения в исследовательский дневник.', 'Ольга Опытова', 'Биолог и педагог. Ведёт безопасные практические исследования.'],
  ['Открытый мир', 'Английский язык', 'Иностранные языки', 'Москва, Спиридоновка, 10', 55.7601, 37.5928, 650, '1763098844157-d0fffcc966a1', 'Jun Ren', 'https://unsplash.com/photos/sunlight-streams-into-an-empty-classroom-with-desks-RTFX0TQHXko', 'Английский через игру', 'Знакомимся, разыгрываем сценки и учимся понимать простые фразы на слух.', 'Ирина Вестова', 'Преподаватель английского. Ведёт разговорные занятия для начинающих.'],
] as const;

export const demoVenues: VenueInput[] = samples.map((s, index) => {
  const [name, direction, specialty, address, latitude, longitude, price, photo, credit, source, program, description, teacher, bio] = s;
  const id = `demo-${index + 1}`;
  return venueInputSchema.parse({
    id, name, address, latitude, longitude, district: 'Пресненский', specialties: [specialty], legacyIds: [], demo: true,
    description: `${name} — вымышленная площадка для знакомства с прототипом. Небольшие группы, знакомство с педагогом и возможность попробовать новое увлечение. Все условия и отзывы демонстрационные.`,
    photos: [{ kind: 'url', url: `https://images.unsplash.com/photo-${photo}?auto=format&fit=max&w=900&q=75`, alt: `Фото-иллюстрация: ${credit} / Unsplash · ${source}` }],
    activities: [{ id: `${id}-activity`, name: program, direction, active: true, description, format: 'Очное занятие в небольшой группе. Подходит начинающим.', teacher: { name: teacher, bio }, groups: [
      { id: `${id}-junior`, name: 'Первооткрыватели', minAge: 8, maxAge: 11, active: true, trialPrice: price, trialCapacity: index === 0 ? 1 : 4,
        schedule: [{ days: [1, 3, 5], start: '17:00', durationMinutes: 60 }, { days: [6], start: '11:00', durationMinutes: 60 }],
        subscriptions: [{ name: 'Месяц открытий', lessons: 8, validDays: 30, price: 6400 + index * 400 }] },
      { id: `${id}-senior`, name: 'Продолжающие', minAge: 12, maxAge: 14, active: true, trialPrice: price + 200, trialCapacity: index === 0 ? 0 : 3,
        schedule: [{ days: [2, 4], start: '19:30', durationMinutes: 60 }], subscriptions: [] },
    ] }],
    reviews: [{ id: `${id}-review`, author: 'Светлана', rating: index % 3 === 0 ? 4 : 5, text: 'Ребёнку понравилось пробовать новое. Педагог спокойно объяснял и помогал.', activityName: program, date: '2026-11-01' }],
  });
});
