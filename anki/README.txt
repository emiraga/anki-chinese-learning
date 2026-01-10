can you add warning that number of items in left and right don't match and card should be fixed first?
---------
on mobile clicking anything flips the card to back side
---------
Click-to-Connect with unique right values support (many-to-one)
---------
we are going to populate files in @anki/connect-dots/ ignore other files in this project. Anki note will have a "Left" and "Right" field which will have a list of comma separated values.
Back card should show us if we did it correctly.
And front card will allow us to connect left items with right items, first element from "Left" field matches first element from the "Right" field, etc. UI should test users ability to connect left and right. But I am not sure what is the best looking and practical UI for this. It should work on mobile and desktop. Intersecting lines could get messy if we require dragging lines between left and right. Perhaps drag items from one list onto another list, and indicate that items were connected. Or perhaps a left column is fixed but right column should be rearranged to match items. Perhaps I would just need to click one item from one list and one item from second list and they would be considered connected.

Bonus points if we have a solution where elements of the right set are displayed only "unique" values, and then we don't know how many left elements are connected with each right element, but ideally UI should work to support this unique values display of right elements.

Propose ideas to implement this in anki cards.
