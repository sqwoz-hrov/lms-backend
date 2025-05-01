import { expect } from 'chai';
import { MarkdownProcessorService } from './markdown-processor.service';
import { FakeImageStorageAdapter } from '../adapter/fake-image-storage.adapter';

describe('MarkdownProcessorService', () => {
	const imageStorageUrl = `https://sqwoz-hrov.ru/`;

	it('Should replace image urls with uploaded image urls', async () => {
		const markdown = `
            ![Image 1](https://example.com/image1.jpg)
            ![Image 2](https://example.com/image2.jpg)
            ![Image 3](https://example.com/image3.jpg)
        `;

		const expectedMarkdown = `
            ![Image 1](${imageStorageUrl}image1.jpg)
            ![Image 2](${imageStorageUrl}image2.jpg)
            ![Image 3](${imageStorageUrl}image3.jpg)
        `;

		const service = new MarkdownProcessorService(new FakeImageStorageAdapter(imageStorageUrl), { imageStorageUrl });

		const processedMarkdown = await service.processMarkdown(markdown);

		expect(processedMarkdown).to.equal(expectedMarkdown);
	});

	it('Should return markdown unchanged if no images are present', async () => {
		const markdown = `This is some text without any images.`;

		const service = new MarkdownProcessorService(new FakeImageStorageAdapter(imageStorageUrl), { imageStorageUrl });

		const processedMarkdown = await service.processMarkdown(markdown);

		expect(processedMarkdown).to.equal(markdown);
	});

	it('Should process markdown with duplicate image urls', async () => {
		const markdown = `
	    	![Image 1](https://example.com/duplicate.jpg)
	    	![Image 2](https://example.com/duplicate.jpg)
	    `;

		const expectedMarkdown = `
	    	![Image 1](${imageStorageUrl}image1.jpg)
	    	![Image 2](${imageStorageUrl}image1.jpg)
	    `;

		const service = new MarkdownProcessorService(new FakeImageStorageAdapter(imageStorageUrl), { imageStorageUrl });

		const processedMarkdown = await service.processMarkdown(markdown);

		expect(processedMarkdown).to.equal(expectedMarkdown);
	});

	it('Should handle malformed image markdown gracefully', async () => {
		const markdown = `
	    	![Image 1](https://example.com/image1.jpg)
	    	![Image 2](not-a-valid-url
	    	Just some text
	    	![](https://example.com/image3.jpg)
	    `;

		const expectedMarkdown = `
	    	![Image 1](${imageStorageUrl}image1.jpg)
	    	![Image 2](not-a-valid-url
	    	Just some text
	    	![](${imageStorageUrl}image2.jpg)
	    `;

		const service = new MarkdownProcessorService(new FakeImageStorageAdapter(imageStorageUrl), { imageStorageUrl });

		const processedMarkdown = await service.processMarkdown(markdown);

		expect(processedMarkdown).to.equal(expectedMarkdown);
	});

	it('Should replace all image urls including reference-style and shortcut references', async () => {
		const markdown = `
			![Inline](https://example.com/inline.jpg)
			![Ref][image1]
			![Collapsed][]
			![Shortcut]

			[image1]: https://example.com/image1.jpg
			[Collapsed]: https://example.com/collapsed.jpg
			[Shortcut]: https://example.com/shortcut.jpg
		`;

		const expectedMarkdown = `
			![Inline](${imageStorageUrl}image1.jpg)
			![Ref][image1]
			![Collapsed][]
			![Shortcut]

			[image1]: ${imageStorageUrl}image2.jpg
			[Collapsed]: ${imageStorageUrl}image3.jpg
			[Shortcut]: ${imageStorageUrl}image4.jpg
		`;

		const service = new MarkdownProcessorService(new FakeImageStorageAdapter(imageStorageUrl), { imageStorageUrl });

		const processedMarkdown = await service.processMarkdown(markdown);

		expect(processedMarkdown).to.equal(expectedMarkdown);
	});
});
