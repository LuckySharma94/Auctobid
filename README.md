# AuctoBid

Frontend: plain HTML/CSS/JS in `frontend/`. Backend: Node + Express + MongoDB in `backend/`.
The frontend talks to the backend (`CONFIG.USE_MOCK` is `false` in `frontend/api.js`). It also has redesigned login/sign-up pages, page animations and clear error messages.

## Run it
You need Node 18+ and a MongoDB database (local, or a free MongoDB Atlas cluster).

    cd backend
    npm install
    # edit .env: set MONGO_URI (local default is already there; for Atlas paste your connection string)
    npm start

Open **http://localhost:5000**. The backend serves the frontend too, so that one address is the whole app.
(Opening the frontend from another server, e.g. `python3 -m http.server 8000`, also works; CORS is enabled.)

On the first start with an empty database the server loads the demo accounts and 9 sample auctions.
Demo auctions that have ended are put back live every time the server starts, so the site never looks empty.
To reload the demo data from scratch (this wipes all users, auctions and bids): `npm run seed`

## Demo accounts
| Email | Password | Notes |
|---|---|---|
| demo@auctobid.com | demo1234 | owns the "Portable Bluetooth speaker" listing (Edit / Delete), is leading on the Premchand set and outbid on the MacBook |
| demo2@auctobid.com | demo1234 | leading on the Sony headphones; use it to bid on the demo user's listing |

The login page also has a **Try the demo account** button.

Try: log in as demo, open My auctions; log out, log in as demo2, bid on the speaker; log back in as demo and see the new bid.

## Endpoints (all under /api)
- POST /auth/register, POST /auth/login -> { token, user }
- GET /auctions?search=&category=&sort=   GET /auctions/:id   GET /auctions/:id/bids
- POST /auctions, PUT /auctions/:id, DELETE /auctions/:id   (owner only)
- POST /auctions/:id/bids { amount }
- POST /uploads (multipart field "image") -> { url }
- GET /users/my-auctions, GET /users/my-bids

The server re-checks everything: auction ended, bid minimum, seller can't bid on own auction, only owners edit/delete, prices locked after the first bid.

## Notes
- Uploaded images are saved in `backend/uploads/`. Hosts with temporary disks (e.g. Render free tier) lose them on restart; use Cloudinary/S3 there.
- When deploying, change `CONFIG.BASE_URL` in `frontend/api.js` to your server's URL (or serve the frontend from the backend and use `"/api"`).
- `.env` holds secrets and is git-ignored. `.env.example` shows every setting.

## Troubleshooting
- **"All auctions" is empty, or you see "Can't reach the AuctoBid server"**: the backend isn't running or can't reach MongoDB. Run `npm start` in `backend/` and read the terminal. Success looks like `MongoDB connected` then `AuctoBid running on http://localhost:5000`. Then open http://localhost:5000.
- **MongoDB errors**: check `MONGO_URI` in `backend/.env`. For Atlas, allow your IP under Network Access and URL-encode special characters in the password.
- **No photos**: the first start needs internet to fetch them from Wikipedia. Run `npm run seed` again while online.
- **Logged in but everything says "log in again"**: an old session from before the backend existed. The app clears it and sends you to the login page.
