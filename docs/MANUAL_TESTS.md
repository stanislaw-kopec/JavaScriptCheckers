# Sprawdzenie gry w przeglądarce

Testy automatyczne nie potwierdzają wyglądu ani działania w konkretnej przeglądarce. Poniższe pola pozostają nieoznaczone do czasu rzeczywistego wykonania prób.

## Start i obsługa

- [ ] Otwórz `index.html`. Widać złoto-czarną planszę, po 12 pionków, zasady, komunikat o turze złotych i przycisk **Nowa gra**.
- [ ] Przy używanej wielkości okna można przeczytać komunikaty i dotrzeć do całej planszy oraz przycisku.
- [ ] Kliknij czarny pionek przed pierwszym ruchem złotych. Nie powinien się zaznaczyć.
- [ ] Kliknij złoty pionek w rzędzie najbliższym środka. Powinny pojawić się obwódka i kropki na dostępnych polach.
- [ ] Kliknij jasne pole albo zajęte pole przeciwnika. Pionek nie powinien się tam przenieść.
- [ ] Wykonaj legalny ruch na pole z kropką. Komunikat i oznaczenie gracza powinny przełączyć się na czarne.
- [ ] Kliknij **Nowa gra**. Powinno wrócić początkowe ustawienie i tura złotych, bez odświeżania strony.

## Pełna partia we dwie osoby

Rozegrajcie partię do wyniku. Jeżeli nie zawiera którejś sytuacji, sprawdźcie ją w kolejnej; nie oznaczajcie próby jako wykonanej tylko dlatego, że przechodzą testy automatyczne.

- [ ] Przy możliwości bicia program blokuje zwykły ruch i pokazuje komunikat o obowiązkowym biciu.
- [ ] Zwykły pionek potrafi zbić także do tyłu.
- [ ] Jeśli są sekwencje różnej długości, można rozpocząć tylko taką, która zbija najwięcej pionków.
- [ ] W serii bić nie można zmienić pionka ani przekazać tury przed ostatnim biciem. Zbite pionki są przygaszone i znikają po zakończeniu serii.
- [ ] Pionek kończący cały ruch na ostatnim rzędzie przeciwnika otrzymuje czytelną koronę.
- [ ] Damka porusza się po dłuższej wolnej przekątnej i potrafi bić z odległości. Nie przechodzi przez własne pionki.
- [ ] Utrata ostatniego pionka albo zablokowanie wszystkich ruchów powoduje ogłoszenie właściwego zwycięzcy.
- [ ] Po wyniku nie można już przesuwać pionków.
- [ ] **Nowa gra** po wyniku przywraca 24 zwykłe pionki, usuwa wynik i pozwala ponownie grać złotymi.
- [ ] **Nowa gra** w środku serii bić również przywraca stan początkowy, bez przygaszeń i wymuszonej kontynuacji.

## Po opublikowaniu

- [ ] Otwórz publiczny adres i sprawdź, czy wczytały się style oraz obsługa gry.
- [ ] Wykonaj po jednym ruchu obu kolorów i rozpocznij nową grę.
- [ ] Sprawdź stronę także w drugiej przeglądarce dostępnej na komputerze.

## Notatki ze sprawdzenia

- Data:
- Przeglądarka i wersja:
- Wynik partii:
- Zauważone problemy:
