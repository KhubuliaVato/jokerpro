"use client";

import { useT } from "@/lib/i18n";
import { PageShell } from "./PageShell";
import { rise } from "./ui";

export const CONTACT_EMAIL = "proprojectscom@gmail.com";

type Text = [string, string, string];

const SECTIONS: { title: Text; body: Text[] }[] = [
  {
    title: ["ვინ ვართ", "Who we are", "Кто мы"],
    body: [
      [
        "ProJoker არის ონლაინ კარტის თამაშების საიტი (ჯოკერი, ბურა, პოკერი). ეს გვერდი გიხსნით, რა მონაცემებს ვინახავთ და როგორ შეგიძლიათ მათი წაშლა.",
        "ProJoker is a website for online card games (Joker, Bura, Poker). This page explains what data we keep and how you can have it deleted.",
        "ProJoker — сайт онлайн-карточных игр (Джокер, Бура, Покер). Здесь описано, какие данные мы храним и как их удалить.",
      ],
    ],
  },
  {
    title: ["რა მონაცემებს ვინახავთ", "What data we keep", "Какие данные мы храним"],
    body: [
      [
        "ელფოსტის მისამართი და, თუ პაროლით დარეგისტრირდით, პაროლის დაშიფრული ვარიანტი (პაროლს თავად ვერ ვხედავთ).",
        "Your email address and, if you signed up with a password, an encrypted form of it (we cannot read your password).",
        "Адрес почты и, если вы регистрировались с паролем, его зашифрованный вид (сам пароль мы прочитать не можем).",
      ],
      [
        "თამაშში არჩეული მეტსახელი, ავატარი (ფერი, ნიშანი ან თქვენი ატვირთული სურათი) და პროფილის თარიღი.",
        "The nickname you choose, your avatar (a colour and symbol, or a picture you upload) and the date the profile was made.",
        "Выбранный никнейм, аватар (цвет и значок или загруженная вами картинка) и дата создания профиля.",
      ],
      [
        "თამაშის მონაცემები: შედეგები, რეიტინგი, მონეტები, ნივთები და საჩუქრები, მაგიდის ჩატის შეტყობინებები.",
        "Game data: results, rating, coins, items and gifts, and messages in the table chat.",
        "Игровые данные: результаты, рейтинг, монеты, предметы и подарки, сообщения в чате за столом.",
      ],
      [
        "Google-ით ან Facebook-ით შესვლისას ვიღებთ მხოლოდ ელფოსტას და პროფილის საბაზისო მონაცემებს. თქვენს მეგობრებს, პოსტებს ან სხვა მონაცემებს არ ვითხოვთ.",
        "When you sign in with Google or Facebook we receive only your email and basic profile details. We do not ask for your friends, posts or other data.",
        "При входе через Google или Facebook мы получаем только почту и базовые данные профиля. Друзей, публикации и прочее мы не запрашиваем.",
      ],
    ],
  },
  {
    title: ["რისთვის ვიყენებთ", "What we use it for", "Для чего мы это используем"],
    body: [
      [
        "მხოლოდ თამაშისთვის: ანგარიშში შესასვლელად, მოთამაშეების ერთმანეთისთვის საჩვენებლად (მეტსახელი, ავატარი, რეიტინგი), ლიდერბორდისა და მაღაზიისთვის. მონაცემებს არ ვყიდით და რეკლამისთვის არ ვიყენებთ.",
        "Only to run the game: signing you in, showing players to each other (nickname, avatar, rating), the leaderboard and the shop. We do not sell your data or use it for advertising.",
        "Только для работы игры: вход в аккаунт, показ игроков друг другу (никнейм, аватар, рейтинг), таблица лидеров и магазин. Мы не продаём данные и не используем их для рекламы.",
      ],
    ],
  },
  {
    title: ["სად ინახება", "Where it is kept", "Где это хранится"],
    body: [
      [
        "მონაცემები ინახება Supabase-ის სერვერზე ევროპაში (ფრანკფურტი), საიტი კი Netlify-ზეა განთავსებული. Google და Facebook მხოლოდ მაშინ მონაწილეობენ, როცა მათით შედიხართ.",
        "Data is kept on Supabase servers in Europe (Frankfurt), and the site is hosted on Netlify. Google and Facebook take part only when you sign in with them.",
        "Данные хранятся на серверах Supabase в Европе (Франкфурт), сайт размещён на Netlify. Google и Facebook участвуют только когда вы входите через них.",
      ],
      [
        "ბრაუზერში ვინახავთ მხოლოდ საჭიროს: შესვლის სესიას, ენას, არჩეულ ფონს და მსგავს პარამეტრებს. სარეკლამო თრექერებს არ ვიყენებთ.",
        "In your browser we keep only what is needed: your sign-in session, language, chosen background and similar settings. We use no advertising trackers.",
        "В браузере мы храним только необходимое: сессию входа, язык, выбранный фон и подобные настройки. Рекламных трекеров нет.",
      ],
    ],
  },
  {
    title: ["როგორ წაშალოთ თქვენი მონაცემები", "How to delete your data", "Как удалить свои данные"],
    body: [
      [
        "პროფილის გვერდზე, ზედა კუთხეში გადაცემათა კოლოფის ღილაკზე დააჭირეთ და აირჩიეთ „ანგარიშის წაშლა“. დაადასტურეთ მეტსახელის ჩაწერით და ანგარიში სამუდამოდ წაიშლება: პროფილი, სურათი, მონეტები, ნივთები, რეიტინგი, თამაშების ისტორია და საჩუქრები.",
        "On your profile page, click the gear button in the top corner and choose “Delete account”. Confirm by typing your nickname and the account is deleted for good: profile, picture, coins, items, rating, game history and gifts.",
        "На странице профиля нажмите шестерёнку в верхнем углу и выберите «Удалить аккаунт». Подтвердите вводом никнейма — аккаунт будет удалён навсегда: профиль, картинка, монеты, предметы, рейтинг, история игр и подарки.",
      ],
      [
        `თუ ანგარიშში ვეღარ შედიხართ, მოგვწერეთ ${CONTACT_EMAIL}-ზე იმავე ელფოსტიდან, რომლითაც დარეგისტრირდით, და ანგარიშს ჩვენ წავშლით.`,
        `If you can no longer sign in, write to ${CONTACT_EMAIL} from the email you signed up with and we will delete the account for you.`,
        `Если вы больше не можете войти, напишите на ${CONTACT_EMAIL} с почты, на которую регистрировались, и мы удалим аккаунт.`,
      ],
      [
        "Google-ით ან Facebook-ით შესვლისას ამ პროვაიდერის მხარეს ჩვენთვის მიცემულ წვდომასაც შეგიძლიათ გააუქმოთ მათ პარამეტრებში.",
        "If you signed in with Google or Facebook, you can also revoke the access you gave us in that provider's own settings.",
        "Если вы входили через Google или Facebook, вы можете также отозвать выданный нам доступ в настройках этого сервиса.",
      ],
    ],
  },
  {
    title: ["ბავშვები", "Children", "Дети"],
    body: [
      [
        "საიტი 13 წლამდე ბავშვებისთვის არ არის განკუთვნილი და მათგან მონაცემებს შეგნებულად არ ვაგროვებთ.",
        "The site is not meant for children under 13 and we do not knowingly collect their data.",
        "Сайт не предназначен для детей младше 13 лет, и мы сознательно не собираем их данные.",
      ],
    ],
  },
  {
    title: ["კონტაქტი", "Contact", "Контакты"],
    body: [
      [
        `კითხვებისთვის მოგვწერეთ: ${CONTACT_EMAIL}`,
        `Questions? Write to us: ${CONTACT_EMAIL}`,
        `Вопросы? Пишите нам: ${CONTACT_EMAIL}`,
      ],
      [
        "ეს წესები შეიძლება შეიცვალოს; ცვლილებას ამავე გვერდზე გამოვაქვეყნებთ.",
        "These rules may change; any change will be published on this page.",
        "Эти правила могут измениться; изменения будут опубликованы на этой странице.",
      ],
    ],
  },
];

/** The privacy policy (also where deleting an account is explained, as Facebook and Google ask for). */
export function PrivacyPage() {
  const t = useT();
  return (
    <PageShell width="max-w-3xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <h1 className="text-[clamp(1.8rem,9vw,2.4rem)] font-extrabold tracking-tight sm:text-5xl">
          {t("კონფიდენციალურობის პოლიტიკა", "Privacy Policy", "Политика конфиденциальности")}
        </h1>
        <p className="text-sm text-white/45">{t("განახლებულია: 2026 წლის ნოემბერი", "Updated: November 2026", "Обновлено: ноябрь 2026")}</p>
      </section>
      <div className="flex flex-col gap-8 pb-10" style={rise(2)}>
        {SECTIONS.map((s, i) => (
          <section key={i} className="flex flex-col gap-3">
            <h2 className="text-xl font-extrabold text-amber-200">{t(...s.title)}</h2>
            {s.body.map((p, j) => (
              <p key={j} className="text-base leading-relaxed text-white/75">
                {t(...p)}
              </p>
            ))}
          </section>
        ))}
      </div>
    </PageShell>
  );
}
