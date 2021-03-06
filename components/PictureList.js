/*******************************************************************************
** @Author:					Thomas Bouder <Tbouder>
** @Email:					Tbouder@protonmail.com
** @Date:					Friday 17 January 2020 - 15:15:55
** @Filename:				PictureList.js
**
** @Last modified by:		Tbouder
** @Last modified time:		Thursday 13 February 2020 - 14:57:38
*******************************************************************************/

import	React, {useState, useEffect}	from	'react';
import	styled							from	'styled-components';
import	PhotoCardWidth					from	'./PhotoCardWidth';
import	{PerDayInfiniteList}			from	'./InfiniteList';
import	AlbumSelectionModal				from	'./AlbumSelectionModal';
import	ToastUpload						from	'./ToastUpload';
import	ToastSuccess					from	'./ToastSuccess';
import	PictureLightroom				from	'./PictureLightroom';
import	DragNDrop						from	'./DragNDrop';
import	* as API						from	'../utils/API';
import	{ActionBar}						from	'./Navbar';
import	useKeyPress						from	'../hooks/useKeyPress';
import	convertToMoment					from	'../utils/ConvertDate';

const	Toggle = styled.div`
	cursor: pointer;
	width: 24px;
	height: 24px;
	margin-right: 8px;
	mask-size: contain;
	mask-repeat: no-repeat;
	mask-position: center;
	transition: 0.3s;
`;

const	StyledDate = styled.div`
	font-size: 14px;
	color: #B5B7DF;
	margin-top: 8px;
	margin-bottom: 8px;
	display: flex;
    align-items: center;
	height: 24px;
	width: 100%;
	position: relative;
	cursor: pointer;
	& > p {
		margin-left: -32px;
		transition: 0.2s;
	}


	${props => props.isToggleSome && '& > p {margin-left: 0; transition: 0.2s;}'};
	${props => props.isToggleSelected && '& > p {margin-left: 0; transition: 0.2s;}'};
	& > ${Toggle} {
		${props => props.isToggleSome && `background-color: #FFFFFF`};
		${props => props.isToggleSome && `opacity: 1`};
		${props => props.isToggleSome && `z-index: 1`};

		${props => props.isToggleSelected ? `mask: url('/static/icons/checked.svg')` : `mask: url('/static/icons/unchecked.svg')`};
		${props => props.isToggleSelected && `background-color: #FFFFFF`};
		${props => props.isToggleSelected && `opacity: 1`};
		${props => props.isToggleSelected && `z-index: 1`};
	}

	&:hover {
		& > p {
			margin-left: 0;
			transition: 0.2s;
		}
		& > ${Toggle} {
			opacity: 1;
			z-index: 1;
			background-color: #FFFFFF;
		}
	}

`;

function	Uploader(props) {
	const	[uploader, set_uploader] = useState(false);
	const	[uploaderUpdate, set_uploaderUpdate] = useState(0);
	const	[uploaderLength, set_uploaderLength] = useState(0);
	const	[uploaderCurrentIndex, set_uploaderCurrentIndex] = useState(0);
	const	[uploaderCurrentStep, set_uploaderCurrentStep] = useState(0);
	const	[uploaderCurrentFile, set_uploaderCurrentFile] = useState(undefined);
	// const	[isDragNDrop, set_isDragNDrop] = useState(props.isDragNDrop);

	function	PictureCompress(file, callback) {
		const fileName = file.name;
		const reader = new FileReader();

		reader.readAsDataURL(file);
		reader.onload = event => {

			const img = new Image();
			img.src = event.target.result;
			img.name = fileName;
			img.onload = (e) => {
				if (e.target.width * e.target.height > 16000000) {
					const	imageOriginalWidth = e.target.width
					const	imageOriginalHeight = e.target.height

					const	hvRatio = imageOriginalWidth / imageOriginalHeight
					const	vhRatio = imageOriginalHeight / imageOriginalWidth

					const	imageHvRatio = 16000000 * hvRatio
					const	imageVhRatio = 16000000 * vhRatio

					const	newWidth = Math.sqrt(imageHvRatio)
					const	newHeight = Math.sqrt(imageVhRatio)

					const canvas = document.createElement('canvas');
					canvas.width = newWidth;
					canvas.height = newHeight;

					const ctx = canvas.getContext('2d');
					ctx.drawImage(img, 0, 0, newWidth, newHeight);
					canvas.toBlob(blob => callback(blob), file.type, 0.85);
				} else {
					callback(file, event.target.result);
				}
			},
			reader.onerror = error => console.log(error);
		};
	}
	function	CreatePictureThumbnail(file) {
		const	thumbSize = 220;
		let		canvas = document.createElement('canvas');
		canvas.width = thumbSize;
		canvas.height = thumbSize;
		var c = canvas.getContext("2d");
		var img = new Image();
		img.onload = function(e) {
			URL.revokeObjectURL(file)
			c.drawImage(this, 0, 0, thumbSize, thumbSize);
			set_uploaderCurrentFile(canvas.toDataURL('image/jpeg', 0.8));
		};
		img.src = URL.createObjectURL(file);
	}
	function	recursiveUpload(index, files) {
		if (index >= files.length) {
			set_uploader(false);
			set_uploaderLength(0);
			set_uploaderCurrentIndex(0);
			set_uploaderCurrentStep(0);
			set_uploaderCurrentFile(undefined);
			return;
		}

		const	file = files[index]
		CreatePictureThumbnail(file)
		PictureCompress(file, (resizedFile) => {
			set_uploader(true)
			if (!(resizedFile instanceof File)) {
				resizedFile.name = file.name
				resizedFile.lastModified = file.lastModified
			}
			API.WSCreateChunkPicture(resizedFile, (UUID) => API.CreateChunkPicture(UUID, resizedFile, props.albumID), (response, currentFile) => {
				if (response.Step === 4) {
					if (response.Picture && response.Picture.uri !== '' && response.IsSuccess === true) {
						response.Picture.dateAsKey = convertToMoment(response.Picture.originalTime)

						props.set_pictureList(_prev => [..._prev, response.Picture])
						set_uploaderCurrentIndex(index => index + 1);
						set_uploaderCurrentStep(0);
						set_uploaderUpdate(_prev => _prev + 1);
						URL.revokeObjectURL(currentFile);
						recursiveUpload(index + 1, files)
					} else {
						set_uploaderCurrentStep(0);
						URL.revokeObjectURL(currentFile);
						recursiveUpload(index, files)
					}
				} else {
					set_uploaderCurrentStep(response.Step)
				}	
			})
		})
	}

	return (
		<>
			<DragNDrop
				isOpen={props.isDragNDrop}
				onDragLeave={() => props.set_isDragNDrop(false)}
				onDrop={(event) => {
					props.set_isDragNDrop(false);
					set_uploaderLength(event.dataTransfer.files.length)
					recursiveUpload(0, event.dataTransfer.files)
				}} />
			<ToastUpload
				open={uploader}
				file={uploaderCurrentFile}
				total={uploaderLength}
				current={uploaderCurrentIndex}
				step={uploaderCurrentStep} />
		</>
	);
}

function	PictureList(props) {
	const	[update, set_update] = useState(0);
	const	[isReady, set_isReady] = useState(false);

	const	[pictureList, set_pictureList] = useState(props.pictureList);
	
	const	[selectMode, set_selectMode] = useState(false);
	const	[selectedPictures, set_selectedPictures] = useState([]);
	const	[selectedDays, set_selectedDays] = useState({});
	const	[albumSelectionModal, set_albumSelectionModal] = useState(false);
	const	[successToast, set_successToast] = useState(false);
	
	const	[lightRoom, set_lightRoom] = useState(false);
	const	[lightRoomIndex, set_lightRoomIndex] = useState(0);
	
	const	isShift = useKeyPress('Shift');
	const	[lastCheck, set_lastCheck] = useState(-1);

	useEffect(() => {
		set_pictureList(props.pictureList);
		set_update(prev => prev + 1);
		set_isReady(true);
	}, [props.pictureList])

	if (!isReady)
		return (null);

	function	onDeletePicture(_selectedPictures = selectedPictures) {
		API.DeletePictures({picturesID: _selectedPictures}).then(() => {
			const	_pictureList = pictureList.filter(item => _selectedPictures.findIndex(elem => elem === item.uri) == -1)
			props.set_pictureList(_pictureList);
			set_selectedPictures([]);
			set_selectedDays({});
			set_selectMode(false);
		});
	}
	function	onSetAlbumCover() {
		API.SetAlbumCover({
			albumID: props.albumID,
			coverPicture0ID: selectedPictures[0] || '',
			coverPicture1ID: selectedPictures[1] || '',
			coverPicture2ID: selectedPictures[2] || '',
		}).then((e) => {
			set_successToast(true);
			set_selectedPictures([]);
			set_selectedDays({});
			set_selectMode(false);
		})
	}

	/**************************************************************************
	**	On select an image, we need to update the list of selected images
	**	and the selected days to update the checkboxes
	**************************************************************************/
	function	updateSelectedPicture(element) {
		const	_selectedPictures = selectedPictures;
		const	pictureSelected = _selectedPictures.indexOf(element.uri);
		const	daysToRecheck = {};

		if (pictureSelected >= 0)
			_selectedPictures.splice(pictureSelected, 1);
		else
			_selectedPictures.push(element.uri);

		daysToRecheck[element.day] = true;
		updateDaysCheckBox(daysToRecheck, _selectedPictures);
		set_selectedPictures(_selectedPictures);
		set_selectMode(_selectedPictures.length > 0);
		set_update(prev => prev + 1);
	}
	function	batchUpdateSelectedPictures(element, elemIndex) {
		const	_selectedPictures = selectedPictures;
		const	pictureSelected = _selectedPictures.indexOf(element.uri);
		const	daysToRecheck = {};
		const	batchFirst = lastCheck > elemIndex ? elemIndex : lastCheck;
		const	batchLast = lastCheck > elemIndex ? lastCheck : elemIndex;

		for (let i = batchFirst; i <= batchLast; i++) {
			if (pictureSelected >= 0) {
				//BATCH UNSELECT
				const	toUnselectIndex = _selectedPictures.indexOf(pictureList[i].uri);
				if (toUnselectIndex >= 0) {
					_selectedPictures.splice(toUnselectIndex, 1);
					daysToRecheck[pictureList[i].dateAsKey] = true
				}
			} else {
				//BATCH SELECT
				const	toSelectIndex = _selectedPictures.indexOf(pictureList[i].uri);
				if (toSelectIndex === -1) {
					_selectedPictures.push(pictureList[i].uri);
					daysToRecheck[pictureList[i].dateAsKey] = true
				}
			}
		}
		updateDaysCheckBox(daysToRecheck, _selectedPictures)
		set_selectedPictures(_selectedPictures);
		set_selectMode(_selectedPictures.length > 0);
		set_update(prev => prev + 1);
	}
	function	updateDaysCheckBox(daysToCheck, _selectedPictures) {
		const	_selectedDays = selectedDays;

		Object.keys(daysToCheck).map((eachDay) => {
			const	dayPictures = pictureList.filter(elem => elem.dateAsKey === eachDay).map(e => e.uri);
			const	selectedDayPictures = _selectedPictures.filter(elem => dayPictures.indexOf(elem) > -1);

			if (selectedDayPictures.length === 0) {
				_selectedDays[eachDay] = `NONE`;
			} else if (selectedDayPictures.length === dayPictures.length) {
				_selectedDays[eachDay] = `FULL`;
			} else {
				_selectedDays[eachDay] = `SOME`;
			}
		})
		set_selectedDays(_selectedDays);
	}
	function	onDayToggleClick(day) {
		const	dayPictures = pictureList.filter(elem => elem.dateAsKey === day).map(e => e.uri);
		const	selectedDayPictures = selectedPictures.filter(elem => dayPictures.indexOf(elem) > -1);
		
		if (selectedDayPictures.length === 0) {
			/* SHOULD SELECT ALL */
			const	_selectedPictures = [...selectedPictures, ...dayPictures];
			const	_selectedDays = selectedDays;
			_selectedDays[day] = `FULL`

			// console.log(pictureList.find(e => e.uri === dayPictures[dayPictures.length - 1]).originalIndex)
			set_selectedPictures(_selectedPictures);
			set_selectedDays(_selectedDays);
			set_selectMode(true);
			set_update(prev => prev + 1);
			set_lastCheck(pictureList.find(e => e.uri === dayPictures[dayPictures.length - 1]).originalIndex)
		} else if (selectedDayPictures.length === dayPictures.length) {
			/* SHOULD UNSELECT ALL */
			const	_selectedPictures = selectedPictures.filter(elem => dayPictures.indexOf(elem) === -1);
			const	_selectedDays = selectedDays;

			_selectedDays[day] = `NONE`
			
			set_lastCheck(-1);
			set_selectedPictures(_selectedPictures);
			set_selectedDays(_selectedDays);
			set_selectMode(_selectedPictures.length > 0);
			set_update(prev => prev + 1);
		} else {
			/* SHOULD SELECT SOME */
			const	toSelect = dayPictures.filter(elem => selectedDayPictures.indexOf(elem) === -1);
			const	_selectedPictures = [...selectedPictures, ...toSelect];
			const	_selectedDays = selectedDays;
			
			_selectedDays[day] = `FULL`

			set_lastCheck(pictureList.find(e => e.uri === dayPictures[dayPictures.length - 1]).originalIndex)
			set_selectedPictures(_selectedPictures);
			set_selectedDays(_selectedDays);
			set_selectMode(true);
			set_update(prev => prev + 1);
		}
	}

	function	renderImage(element, elemIndex) {
		return (
			<PhotoCardWidth
				key={`${element.uri}_${elemIndex}`}
				uri={`${API.API}/downloadPicture/500x500/${element.uri}`}
				width={element.width}
				height={element.height}
				isSelectMode={selectMode}
				isSelected={selectedPictures.indexOf(element.uri) > -1}
				onToggle={() => {
					if (isShift && lastCheck > -1)
						batchUpdateSelectedPictures(element, elemIndex);
					else
						updateSelectedPicture(element);
					set_lastCheck(elemIndex);
				}}
				onClick={() => {
					set_lightRoomIndex(elemIndex);
					set_lightRoom(true);
				}}
				alt={'img'} />
		);
	}

	function	renderDaySeparator(day) {
		const	days = [`Dimanche`, `Lundi`, `Mardi`, `Mercredi`, `Jeudi`, `Vendredi`, `Samedi`];
		const	months = [`Janvier`, `Février`, `Mars`, `Avril`, `Mai`, `Juin`, `Juillet`, `Août`, `Septembre`, `Octobre`, `Novembre`, `Décembre`];

		const	fullDate = new Date(day);

		return (
			<StyledDate
				isToggleSelected={selectedDays[day] === 'FULL'}
				isToggleSome={selectedDays[day] === 'SOME'}
				onClick={() => onDayToggleClick(day)}>
				<Toggle />

				<p>{`${days[fullDate.getDay()]} ${fullDate.getDate()} ${months[fullDate.getMonth()]} ${fullDate.getFullYear()}`}</p>
			</StyledDate>
		)
	}

	return (
		<div>
			<ActionBar
				isEnabled={selectMode}
				albumID={props.albumID}
				onCancel={() => {
					set_selectedPictures([]);
					set_selectedDays({});
					set_selectMode(false);
				}}
				onAddToAlbum={() => set_albumSelectionModal(true)}
				onDeletePicture={onDeletePicture}
				onSetCover={onSetAlbumCover}
				len={selectedPictures.length} />
			<PerDayInfiniteList
				renderChildren={renderImage}
				renderDaySeparator={renderDaySeparator}
				childrenContainer={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 16}}
				pictureList={pictureList} />
			<AlbumSelectionModal
				isOpen={albumSelectionModal}
				onClose={() => {
					set_albumSelectionModal(false);
					set_selectedPictures([]);
					set_selectedDays({});
					set_selectMode(false);
				}}
				albumList={props.albumList}
				selected={selectedPictures} />
			<ToastSuccess
				isOpen={successToast}
				onClose={() => set_successToast(false)}
				status={'Les photos de couverture de l\'album ont été mises à jour'} />
			<Uploader
				albumID={props.albumID}
				set_pictureList={props.set_pictureList}
				isDragNDrop={props.isDragNDrop}
				set_isDragNDrop={props.set_isDragNDrop} />
			{lightRoom && <PictureLightroom
				onClose={() => set_lightRoom(false)}
				onDeletePicture={e => onDeletePicture([e.uri])}
				list={pictureList}
				originalIndex={lightRoomIndex} />
			}
		</div>
	);
}

export default PictureList;
