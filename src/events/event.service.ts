import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEventDto } from './dtos/create-event.dto';
import { Event } from './entities/event-entity';
import { UpdateEventDto } from './dtos/update-event.dto';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class EventsService {
  private readonly topicArn = process.env.AWS_SNS_TOPIC_ARN;

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    const event = this.eventRepository.create(createEventDto);
    const savedEvent = await this.eventRepository.save(event);

    // Notify clients of the new event
    const message = JSON.stringify({ type: 'newEvent', data: savedEvent });
    await this.notificationsService.publish(this.topicArn, message);

    return savedEvent;
  }

  async findAll(): Promise<Event[]> {
    return this.eventRepository.find({ relations: ['match'] });
  }

  async findOne(id: number): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['match'],
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return event;
  }

  async update(id: number, updateEventDto: UpdateEventDto): Promise<Event> {
    await this.findOne(id); // Ensure the entity exists
    await this.eventRepository.update(id, updateEventDto);
    const updatedEvent = await this.findOne(id);

    // Notify clients of the updated event
    const message = JSON.stringify({ type: 'updateEvent', data: updatedEvent });
    await this.notificationsService.publish(this.topicArn, message);

    return updatedEvent;
  }

  async remove(id: number): Promise<void> {
    const event = await this.findOne(id); // Ensure the entity exists
    await this.eventRepository.remove(event);

    // Notify clients of the deleted event
    const message = JSON.stringify({ type: 'deleteEvent', data: { id } });
    await this.notificationsService.publish(this.topicArn, message);
  }
}
