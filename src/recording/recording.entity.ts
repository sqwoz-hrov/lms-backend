import { EventType } from '../event-type/event-type.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('recordings')
export class Recording {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  eventTypeId: number;

  @ManyToOne(() => EventType, eventType => eventType.recordings, { eager: true })
  @JoinColumn({ name: 'eventTypeId' })
  eventType: EventType;

  @Column()
  url: string;
}
