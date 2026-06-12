import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore'
import type { ZodType } from 'zod'

// One typed converter factory for every entity. On read it injects the doc id
// and validates the whole shape with the entity's Zod schema (applying defaults
// and rejecting malformed docs); on write it strips the id (it is the doc key,
// not a stored field). Used via collectionRef.withConverter(zodConverter(Schema)).
export function zodConverter<T extends { id: string }>(
  schema: ZodType<T>,
): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T) {
      const { id: _id, ...rest } = data
      return rest
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): T {
      const raw = { id: snapshot.id, ...snapshot.data(options) }
      return schema.parse(raw)
    },
  }
}
