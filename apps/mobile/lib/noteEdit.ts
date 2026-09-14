import type { Note } from "@lehno/contracts";

/**
 * Correcting and removing a note.
 *
 * The server gained both on 14 September; nothing could ask for either. A note
 * is what someone privately wrote about a person they love, and it feeds the
 * model's prompts: a typo, a name spelt wrong, a note written on the wrong
 * person went on shaping every portrait and every message, with no recourse.
 *
 * ONLY THE TEXT CHANGES, and the contract is explicit about why the rest does
 * not. The person is not editable — "a slip would change the subject without
 * saying so". The occasion is not either — it separates a note about a moment
 * from a note about someone, and moving it would change the note's NATURE
 * rather than its wording. So the editing screen does not show those two at
 * all: showing them read-only invites the attempt, showing them editable lies.
 *
 * The categories are not ours to send. The server reclassifies from the new
 * text — « à éviter » follows the words, and a correction that removed the
 * warning would have to remove its dashed border too.
 */

export interface NoteCall {
  path: string;
  body?: { content: string };
}

const path = (personId: string, noteId: string): string =>
  `/me/persons/${personId}/notes/${noteId}`;

export function correctionCall(personId: string, noteId: string, content: string): NoteCall {
  /* Trimmed HERE, not at the field: the field must let someone type a space
     without the button flickering. The server trims too — `updateNoteSchema`
     does — and sending the untrimmed text would make the two disagree on what
     was saved. */
  return { path: path(personId, noteId), body: { content: content.trim() } };
}

export function removalCall(personId: string, noteId: string): NoteCall {
  return { path: path(personId, noteId) };
}

/**
 * Whether the correction is worth sending.
 *
 * Empty is refused — the server refuses it too, and a note reduced to nothing
 * is a removal, which has its own gesture and its own confirmation.
 *
 * UNCHANGED IS ALSO REFUSED, and that is not mere thrift: saving reclassifies
 * the categories server-side, so a no-op write is not a no-op. Someone who
 * opens a note, reads it and saves out of habit would see « à éviter » move
 * because the classifier has since changed its mind.
 */
export function correctionWorthSending(original: string, current: string): boolean {
  const text = current.trim();
  return text !== "" && text !== original.trim();
}

/** The note being corrected, among those the person's fiche loaded. */
export function noteBeingEdited(notes: readonly Note[], noteId: string | undefined): Note | null {
  if (noteId === undefined) return null;
  return notes.find((n) => n.id === noteId) ?? null;
}
