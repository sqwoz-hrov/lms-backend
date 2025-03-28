import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Recording } from 'src/recording/recording.entity';
import { OneToMany } from 'typeorm';

@Entity('event_types')
export class EventType {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @OneToMany(() => Recording, recording => recording.eventType)
  recordings: Recording[];
}
