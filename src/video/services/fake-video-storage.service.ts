import { IVideoStorageService } from '../ports/video-storage.service';

export class FakeVideoStorageService implements IVideoStorageService {
	uploadVideo() {
		return Promise.resolve({
			youtubeLink: 'https://www.youtube.com/watch?v=gUdHsp5rs5g',
			s3ObjectId: '00000000-0000-0000-0000-000000000000 ',
		});
	}
}
