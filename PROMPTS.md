# Book Tracker - Prompt Log

Prompt 1: "I want to build a Book Tracker web page using plain HTML, CSS and JavaScript. Features: add a book with title, author and status, show the list newest first, search, change status, and keep the data after a refresh using localStorage."
What happened: The AI provided a complete file structure plan and explained how localStorage serialisation works using JSON.

Prompt 2: "Create index.html, style.css and app.js with form validation, LocalStorage, search filtering, and status updating."
What happened: The files were successfully generated with semantic HTML and local storage integration.

Prompt 3: "Let's redesign the UI/UX to have a dreamy pastel lavender and soft lilac theme with glowing purple accents and glassmorphism cards. Also add a delete button and live counts."
What happened: The UI was updated with a gorgeous lavender palette and stats badges, but initially the delete button icon was too dark and hard to see. 

Prompt 4 (AI Mistake & Fix): "The delete button trashcan icon is blending into the card background and not clearly visible. Fix the button styling and make sure clicking it completely removes the item from the array and localStorage."
What happened: The AI corrected the CSS contrast for the trashcan button and ensured `localStorage` updates correctly on deletion so the book stays removed after a page refresh.

Prompt 5: "Add a 'Clear All Books' button with a confirmation popup and sorting options like Newest First."
What happened: Added full sorting and clear options to make the app fully functional and polished.